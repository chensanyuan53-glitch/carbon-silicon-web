import React, { useState, useEffect } from 'react';
import { supabase } from '../src/supabaseClient';
import { Page } from '../types';
import { User, Mail, Phone, Briefcase, Cpu, Save, ArrowLeft, Camera, Check } from 'lucide-react';

interface ProfileProps {
  onNavigate: (page: Page) => void;
}

type Role = 'carbon' | 'silicon';
const DOMAIN_OPTIONS = ['家装', '农业', '能源', '职场'];

interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  avatar_url?: string;
  contact: string;
  role: Role;
  domains: string[];
  skills: string;
}

export const Profile: React.FC<ProfileProps> = ({ onNavigate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type?: 'success' | 'error' | 'info' }>({ visible: false, message: '', type: 'info' });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  const [profile, setProfile] = useState<UserProfile>({
    id: '',
    email: '',
    nickname: '',
    avatar_url: '',
    contact: '',
    role: 'carbon',
    domains: [],
    skills: ''
  });

  const [editedProfile, setEditedProfile] = useState<UserProfile>({
    id: '',
    email: '',
    nickname: '',
    avatar_url: '',
    contact: '',
    role: 'carbon',
    domains: [],
    skills: ''
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type }), 3000);
  };

  // 获取用户初始字母作为头像
  const getAvatarLetter = (email: string, nickname: string) => {
    return (nickname || email)?.charAt(0).toUpperCase() || 'U';
  };

  // 加载用户信息
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setIsLoading(true);

      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        showToast('获取用户信息失败', 'error');
        onNavigate(Page.HOME);
        return;
      }

      const meta = user.user_metadata || {};
      const loadedProfile: UserProfile = {
        id: user.id,
        email: user.email || '',
        nickname: meta.nickname || '',
        avatar_url: meta.avatar_url || '',
        contact: meta.contact || '',
        role: (meta.role as Role) || 'carbon',
        domains: Array.isArray(meta.domains) ? meta.domains : [],
        skills: meta.skills || ''
      };

      setProfile(loadedProfile);
      setEditedProfile(loadedProfile);
    } catch (error: any) {
      showToast(`加载用户信息失败: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEdit = () => {
    setEditedProfile({ ...profile });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedProfile({ ...profile });
    setAvatarPreview(null);
    setIsEditing(false);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件', 'error');
      return;
    }

    // 验证文件大小 (2MB)
    if (file.size > 2 * 1024 * 1024) {
      showToast('图片大小不能超过2MB', 'error');
      return;
    }

    // 创建预览并转换为 base64
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const toggleDomain = (domain: string) => {
    setEditedProfile(prev => ({
      ...prev,
      domains: prev.domains.includes(domain)
        ? prev.domains.filter(d => d !== domain)
        : [...prev.domains, domain]
    }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        showToast('获取用户信息失败', 'error');
        return;
      }

      // 准备更新数据
      const updates: Record<string, any> = {
        nickname: editedProfile.nickname,
        contact: editedProfile.contact,
        role: editedProfile.role,
        domains: editedProfile.domains,
        skills: editedProfile.skills
      };

      // 如果有头像预览，将 base64 直接存储在元数据中
      if (avatarPreview) {
        updates.avatar_url = avatarPreview;
      }

      // 更新用户元数据
      const { error: updateError } = await supabase.auth.updateUser({
        data: updates
      });

      if (updateError) {
        showToast(`更新失败: ${updateError.message}`, 'error');
        return;
      }

      // 刷新用户信息
      await loadUserProfile();
      // 强制刷新 session 以便 Navbar 获取最新数据
      await supabase.auth.refreshSession();
      setAvatarPreview(null);
      setIsEditing(false);
      showToast('个人信息更新成功', 'success');
    } catch (error: any) {
      showToast(`更新失败: ${error.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 pb-12">
      {/* Toast */}
      {toast.visible && (
        <div style={{ zIndex: 9999 }} className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto max-w-lg w-full mx-4">
            <div className={`rounded-xl border-2 p-5 px-6 shadow-2xl ${toast.type === 'error' ? 'bg-rose-900 border-rose-500' : toast.type === 'success' ? 'bg-emerald-900 border-emerald-500' : 'bg-slate-800 border-cyan-500'} text-white text-center transform transition duration-200 scale-100`}>
              <div className="text-lg font-semibold">{toast.message}</div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => onNavigate(Page.HOME)}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="text-sm font-medium">返回首页</span>
            </button>
            <h1 className="text-lg font-semibold text-white">个人主页</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Profile Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
          {/* Header Background */}
          <div className="h-32 bg-gradient-to-r from-cyan-600 to-blue-600"></div>

          {/* Avatar Section */}
          <div className="px-8 pb-8">
            <div className="flex items-end -mt-16 mb-6">
              <div className="relative">
                {isEditing ? (
                  <>
                    <label className="w-32 h-32 rounded-full bg-slate-700 border-4 border-slate-800 flex items-center justify-center cursor-pointer hover:bg-slate-600 transition-colors group overflow-hidden">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                      {avatarPreview || editedProfile.avatar_url ? (
                        <img
                          src={avatarPreview || editedProfile.avatar_url}
                          alt="头像"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-slate-400 pointer-events-none">
                          <Camera size={32} className="mx-auto mb-2" />
                          <span className="text-xs">更换头像</span>
                        </div>
                      )}
                    </label>
                    <div className="absolute inset-0 w-32 h-32 rounded-full ring-4 ring-cyan-500/30 pointer-events-none"></div>
                  </>
                ) : (
                  <>
                    <div
                      onClick={handleStartEdit}
                      className="w-32 h-32 rounded-full bg-gradient-to-br from-cyan-900 to-blue-900 border-4 border-slate-800 flex items-center justify-center text-4xl font-bold text-cyan-400 shadow-2xl cursor-pointer hover:ring-4 hover:ring-cyan-500/50 transition-all"
                    >
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt="头像"
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        getAvatarLetter(profile.email, profile.nickname)
                      )}
                    </div>
                    <div className="absolute inset-0 w-32 h-32 rounded-full ring-4 ring-cyan-500/30"></div>
                  </>
                )}
              </div>

              <div className="ml-6 mb-2 flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-white">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedProfile.nickname}
                        onChange={(e) => setEditedProfile({ ...editedProfile, nickname: e.target.value })}
                        className="bg-transparent border-b-2 border-cyan-500 text-white focus:outline-none w-64"
                        placeholder="输入昵称"
                      />
                    ) : (
                      profile.nickname || profile.email
                    )}
                  </h2>
                  {isEditing && (
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isSaving ? '保存中...' : <><Save size={14} /> 保存</>}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-sm mt-1">
                  <Mail size={14} />
                  {profile.email}
                </div>
                {!isEditing && (
                  <div className="text-xs text-slate-500 mt-1">
                    💡 点击头像或"编辑资料"按钮修改个人信息
                  </div>
                )}
              </div>

              <div className="mb-2">
                {!isEditing ? (
                  <button
                    onClick={handleStartEdit}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    编辑资料
                  </button>
                ) : (
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    取消
                  </button>
                )}
              </div>
            </div>

            {/* Info Section */}
            <div className="space-y-6">
              {/* Contact */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                  <Phone className="text-cyan-400" size={20} />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-slate-400 mb-1 block">联系方式</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedProfile.contact}
                      onChange={(e) => setEditedProfile({ ...editedProfile, contact: e.target.value })}
                      className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                      placeholder="手机号或微信"
                    />
                  ) : (
                    <p className="text-white">{profile.contact || '未填写'}</p>
                  )}
                </div>
              </div>

              {/* Role */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                  <User className="text-cyan-400" size={20} />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-slate-400 mb-3 block">身份</label>
                  <div className="grid grid-cols-2 gap-4 max-w-md">
                    <div
                      onClick={isEditing ? () => setEditedProfile({ ...editedProfile, role: 'carbon' }) : undefined}
                      className={`cursor-pointer rounded-xl p-4 border-2 transition-all duration-300 flex flex-col items-center text-center gap-2 ${
                        editedProfile.role === 'carbon'
                          ? 'border-orange-500 bg-orange-900/20 shadow-lg shadow-orange-500/10'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
                      } ${!isEditing ? 'pointer-events-none opacity-70' : ''}`}
                    >
                      <div className={`p-2 rounded-full ${editedProfile.role === 'carbon' ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                        <Briefcase size={20} />
                      </div>
                      <div>
                        <h3 className={`font-bold text-sm ${editedProfile.role === 'carbon' ? 'text-white' : 'text-slate-300'}`}>行业专家</h3>
                      </div>
                      {editedProfile.role === 'carbon' && <div className="absolute top-2 right-2 text-orange-500"><Check size={16} /></div>}
                    </div>

                    <div
                      onClick={isEditing ? () => setEditedProfile({ ...editedProfile, role: 'silicon' }) : undefined}
                      className={`cursor-pointer rounded-xl p-4 border-2 transition-all duration-300 flex flex-col items-center text-center gap-2 ${
                        editedProfile.role === 'silicon'
                          ? 'border-cyan-500 bg-cyan-900/20 shadow-lg shadow-cyan-500/10'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
                      } ${!isEditing ? 'pointer-events-none opacity-70' : ''}`}
                    >
                      <div className={`p-2 rounded-full ${editedProfile.role === 'silicon' ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                        <Cpu size={20} />
                      </div>
                      <div>
                        <h3 className={`font-bold text-sm ${editedProfile.role === 'silicon' ? 'text-white' : 'text-slate-300'}`}>AI 探索者</h3>
                      </div>
                      {editedProfile.role === 'silicon' && <div className="absolute top-2 right-2 text-cyan-500"><Check size={16} /></div>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Domains (Carbon) or Skills (Silicon) */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                  {editedProfile.role === 'carbon' ? (
                    <Briefcase className="text-orange-400" size={20} />
                  ) : (
                    <Cpu className="text-cyan-400" size={20} />
                  )}
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-slate-400 mb-3 block">
                    {editedProfile.role === 'carbon' ? '关注领域' : '擅长技能'}
                  </label>

                  {editedProfile.role === 'carbon' ? (
                    <div className={`flex flex-wrap gap-2 ${!isEditing ? 'pointer-events-none opacity-70' : ''}`}>
                      {DOMAIN_OPTIONS.map(domain => (
                        <button
                          key={domain}
                          type="button"
                          onClick={() => isEditing && toggleDomain(domain)}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                            editedProfile.domains.includes(domain)
                              ? 'bg-orange-600 border-orange-500 text-white'
                              : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
                          }`}
                        >
                          {domain}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={editedProfile.skills}
                      onChange={(e) => setEditedProfile({ ...editedProfile, skills: e.target.value })}
                      disabled={!isEditing}
                      placeholder="例如：Midjourney, Python..."
                      className={`w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors ${!isEditing ? 'pointer-events-none opacity-70' : ''}`}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-6 text-center text-sm text-slate-500">
          <p>完善个人信息可以让其他用户更好地了解你</p>
        </div>
      </div>
    </div>
  );
};
