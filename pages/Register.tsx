import React, { useState } from 'react';
import { supabase } from '../src/supabaseClient';
import { Page } from '../types';
import { User, Lock, Briefcase, Cpu, Check, ArrowRight, Phone, LogIn } from 'lucide-react';

interface RegisterProps {
  onNavigate: (page: Page) => void;
}

type Role = 'carbon' | 'silicon';
const DOMAIN_OPTIONS = ['家装', '农业', '能源', '职场'];

export const Register: React.FC<RegisterProps> = ({ onNavigate }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '', // 改名：username -> email，因为 Supabase 用邮箱登录
    password: '',
    contact: '',
  });
  const [role, setRole] = useState<Role>('carbon');
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [skills, setSkills] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type?: 'success' | 'error' | 'info' }>({ visible: false, message: '', type: 'info' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type }), 3000);
  };

  const toggleDomain = (domain: string) => {
    setSelectedDomains(prev => 
      prev.includes(domain) 
        ? prev.filter(d => d !== domain) 
        : [...prev, domain]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (showForgotPassword) {
        // === 忘记密码逻辑 ===
        if (!formData.email) {
          showToast('请输入邮箱地址', 'error');
          return;
        }

        const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) throw error;

        showToast('重置密码邮件已发送到您的邮箱，请查收', 'success');
        setShowForgotPassword(false);

      } else if (isLogin) {
        // === 登录逻辑 ===
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;

        // 登录成功，跳转首页
        onNavigate(Page.HOME);

      } else {
        // === 注册逻辑 ===
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            // 把额外的表单数据存到用户的 "元数据" 里
            data: {
              contact: formData.contact,
              role: role,
              domains: selectedDomains,
              skills: skills
            }
          }
        });

        if (error) throw error;

        // 有些 Supabase 项目开启了邮件确认：signUp 可能不会立刻返回 session
        // 这里做“尽最大可能”的自动登录：如果没有 session，就用密码再登录一次
        const hasSession = Boolean(data.session);
        if (!hasSession) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password,
          });
          if (signInError) throw signInError;
        }

        showToast('注册成功，已为您登录', 'success');
        onNavigate(Page.HOME);
      }
    } catch (error: any) {
      // 根据 Supabase 错误类型返回中文提示
      let errorMessage = '操作失败，请稍后重试';
      
        if (error) {
          const message = error.message?.toLowerCase() || '';

          if (message.includes('invalid login credentials')) {
            errorMessage = '邮箱或密码错误，请检查后重试';
          } else if (message.includes('user not found')) {
            errorMessage = '用户不存在，请检查邮箱是否正确';
          } else if (message.includes('email not confirmed')) {
            errorMessage = '邮箱未验证，请先查收验证邮件';
          } else if (message.includes('weak password')) {
            errorMessage = '密码强度不足，请使用更复杂的密码';
          } else if (message.includes('user already registered')) {
            errorMessage = '该邮箱已被注册，请直接登录';
          } else if (message.includes('invalid email')) {
            errorMessage = '邮箱格式不正确，请检查输入';
          } else if (message.includes('reset password rate limit')) {
            errorMessage = '重置密码请求过于频繁，请稍后再试';
          } else {
            errorMessage = `操作失败: ${error.message}`;
          }
        }
      
      showToast(errorMessage, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -right-24 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-md w-full relative z-10 bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
        
        {/* Header / Tabs */}
        {!showForgotPassword && (
          <div className="flex border-b border-slate-700">
            <button
              onClick={() => { setIsLogin(true); setShowForgotPassword(false); }}
              className={`flex-1 py-4 text-center text-sm font-medium transition-colors ${
                isLogin ? 'bg-slate-800/80 text-white border-b-2 border-cyan-500' : 'bg-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              登录
            </button>
            <button
              onClick={() => { setIsLogin(false); setShowForgotPassword(false); }}
              className={`flex-1 py-4 text-center text-sm font-medium transition-colors ${
                !isLogin ? 'bg-slate-800/80 text-white border-b-2 border-cyan-500' : 'bg-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              注册入驻
            </button>
          </div>
        )}

        <div className="p-8">
          <div className="text-center mb-8">
            <div className="mx-auto w-12 h-12 rounded bg-gradient-to-tr from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-xl mb-4">
              CS
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {showForgotPassword ? '重置密码' : isLogin ? '欢迎回到碳硅合创' : '加入共创社区'}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {showForgotPassword ? '请输入您的注册邮箱，我们将发送重置密码链接' : isLogin ? '登录以继续您的创新之旅' : '连接行业智慧与 AI 能力，共创未来'}
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Email (原 Username) */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={18} className="text-slate-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email" 
                  required
                  className="appearance-none relative block w-full px-3 py-3 pl-10 border border-slate-600 placeholder-slate-500 text-white bg-slate-900/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm transition-all"
                  placeholder="邮箱地址"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>

              {/* Password */}
              {!showForgotPassword && (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={18} className="text-slate-500" />
                  </div>
                  <input
                    key="password-input"
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="appearance-none relative block w-full px-3 py-3 pl-10 border border-slate-600 placeholder-slate-500 text-white bg-slate-900/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm transition-all"
                    placeholder="密码"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
                </div>
              )}

              {/* 忘记密码链接 */}
              {isLogin && !showForgotPassword && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    忘记密码？
                  </button>
                </div>
              )}

              {/* 返回登录按钮 (忘记密码状态) */}
              {showForgotPassword && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    ← 返回登录
                  </button>
                </div>
              )}

              {/* Contact Info (Register Only) */}
              {!isLogin && (
                <div className="relative animate-fade-in">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone size={18} className="text-slate-500" />
                  </div>
                  <input
                    id="contact"
                    name="contact"
                    type="text"
                    required
                    className="appearance-none relative block w-full px-3 py-3 pl-10 border border-slate-600 placeholder-slate-500 text-white bg-slate-900/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm transition-all"
                    placeholder="联系方式 (手机号/微信)"
                    value={formData.contact}
                    onChange={e => setFormData({...formData, contact: e.target.value})}
                  />
                  <p className="mt-1 text-xs text-slate-500 text-right">用于找回密码及接收通知</p>
                </div>
              )}
            </div>

            {/* Role Selection & Extras (Register Only) */}
            {!isLogin && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-3 block">选择你的身份</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div 
                      onClick={() => setRole('carbon')}
                      className={`cursor-pointer rounded-xl p-4 border-2 transition-all duration-300 flex flex-col items-center text-center gap-2 ${
                        role === 'carbon' 
                          ? 'border-orange-500 bg-orange-900/20 shadow-lg shadow-orange-500/10' 
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
                      }`}
                    >
                      <div className={`p-2 rounded-full ${role === 'carbon' ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                        <Briefcase size={20} />
                      </div>
                      <div>
                        <h3 className={`font-bold text-sm ${role === 'carbon' ? 'text-white' : 'text-slate-300'}`}>我是行业专家</h3>
                      </div>
                      {role === 'carbon' && <div className="absolute top-2 right-2 text-orange-500"><Check size={16} /></div>}
                    </div>

                    <div 
                      onClick={() => setRole('silicon')}
                      className={`cursor-pointer rounded-xl p-4 border-2 transition-all duration-300 flex flex-col items-center text-center gap-2 ${
                        role === 'silicon' 
                          ? 'border-cyan-500 bg-cyan-900/20 shadow-lg shadow-cyan-500/10' 
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
                      }`}
                    >
                      <div className={`p-2 rounded-full ${role === 'silicon' ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                        <Cpu size={20} />
                      </div>
                      <div>
                        <h3 className={`font-bold text-sm ${role === 'silicon' ? 'text-white' : 'text-slate-300'}`}>我是 AI 探索者</h3>
                      </div>
                      {role === 'silicon' && <div className="absolute top-2 right-2 text-cyan-500"><Check size={16} /></div>}
                    </div>
                  </div>
                </div>

                {/* Conditional Fields */}
                <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/50">
                  {role === 'carbon' ? (
                    <div className="animate-fade-in">
                      <label className="text-sm font-medium text-slate-300 mb-3 block">关注领域 <span className="text-slate-500 text-xs">(多选)</span></label>
                      <div className="flex flex-wrap gap-2">
                        {DOMAIN_OPTIONS.map(domain => (
                          <button
                            key={domain}
                            type="button"
                            onClick={() => toggleDomain(domain)}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                              selectedDomains.includes(domain)
                                ? 'bg-orange-600 border-orange-500 text-white'
                                : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
                            }`}
                          >
                            {domain}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="animate-fade-in">
                      <label className="text-sm font-medium text-slate-300 mb-2 block">
                        擅长技能 <span className="text-slate-500 text-xs font-normal">(选填)</span>
                      </label>
                      <input
                        type="text"
                        value={skills}
                        onChange={(e) => setSkills(e.target.value)}
                        placeholder="例如：Midjourney, Python...（可留空）"
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">处理中...</span>
              ) : (
                <span className="flex items-center gap-2">
                  {showForgotPassword ? '发送重置邮件' : isLogin ? '立即登录' : '立即入驻'}
                  {!isLogin && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />}
                  {isLogin && <LogIn size={16} />}
                </span>
              )}
            </button>
          </form>
          
          <div className="mt-6 text-center">
               {!showForgotPassword && (
                 <button onClick={() => onNavigate(Page.HOME)} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                     先逛逛，暂不{isLogin ? '登录' : '注册'}
                 </button>
               )}
          </div>

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
        </div>
      </div>
    </div>
  );
};