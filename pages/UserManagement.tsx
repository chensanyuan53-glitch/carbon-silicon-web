import React, { useEffect, useState } from 'react';
import { supabase } from '../src/supabaseClient';
import { Page } from '../types';
import { Shield, Users, Search, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

interface UserManagementProps {
  onNavigate: (page: Page) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ onNavigate }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentAdmin, setCurrentAdmin] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 获取当前管理员状态
  useEffect(() => {
    const fetchCurrentAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .eq('is_admin', true)
          .single();
        if (!data) {
          onNavigate(Page.HOME);
        } else {
          setCurrentAdmin(user.id);
        }
      } else {
        onNavigate(Page.HOME);
      }
    };
    fetchCurrentAdmin();
  }, [onNavigate]);

  // 获取所有用户
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, is_admin, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setUsers(data);
        setFilteredUsers(data);
      }
      setLoading(false);
    };
    fetchUsers();
  }, []);

  // 搜索过滤
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredUsers(users);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredUsers(
        users.filter(
          (user) =>
            user.email.toLowerCase().includes(term) ||
            user.full_name?.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, users]);

  // 设置/取消管理员
  const toggleAdmin = async (userId: string, makeAdmin: boolean) => {
    if (userId === currentAdmin) {
      setNotification({ type: 'error', message: '不能修改自己的管理员权限' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    setUpdatingUserId(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ is_admin: makeAdmin })
      .eq('id', userId);

    if (error) {
      setNotification({ type: 'error', message: `设置失败: ${error.message}` });
    } else {
      setUsers(users.map((u) => (u.id === userId ? { ...u, is_admin: makeAdmin } : u)));
      setNotification({
        type: 'success',
        message: makeAdmin ? '已设置为管理员' : '已取消管理员权限',
      });
    }
    setUpdatingUserId(null);
    setTimeout(() => setNotification(null), 3000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">用户管理</h1>
            <p className="text-slate-400 text-sm">管理系统用户和权限</p>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg flex items-center gap-2 ${
            notification.type === 'success'
              ? 'bg-green-900/30 text-green-400 border border-green-700'
              : 'bg-red-900/30 text-red-400 border border-red-700'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
          {notification.message}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-900/50 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">总用户数</p>
              <p className="text-2xl font-bold text-white">{users.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-cyan-900/50 flex items-center justify-center">
              <Shield className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">管理员数量</p>
              <p className="text-2xl font-bold text-white">
                {users.filter((u) => u.is_admin).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-purple-900/50 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">普通用户</p>
              <p className="text-2xl font-bold text-white">
                {users.filter((u) => !u.is_admin).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="搜索邮箱或姓名..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* User Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            {searchTerm ? '没有找到匹配的用户' : '暂无用户数据'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-400">用户</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-400">邮箱</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-400">注册时间</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-slate-400">角色</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-slate-400">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-cyan-900/50 border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-400 overflow-hidden">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt={user.full_name || '头像'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            (user.full_name || user.email).charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="text-white font-medium">
                            {user.full_name || '未设置昵称'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{user.email}</td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      {user.is_admin ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-900/30 text-cyan-400 text-xs font-medium border border-cyan-700">
                          <Shield className="w-3 h-3" />
                          管理员
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-700 text-slate-300 text-xs font-medium">
                          <Users className="w-3 h-3" />
                          普通用户
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {user.id === currentAdmin ? (
                        <span className="text-slate-500 text-sm">当前用户</span>
                      ) : (
                        <button
                          onClick={() => toggleAdmin(user.id, !user.is_admin)}
                          disabled={updatingUserId === user.id}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            user.is_admin
                              ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-700'
                              : 'bg-cyan-900/30 text-cyan-400 hover:bg-cyan-900/50 border border-cyan-700'
                          }`}
                        >
                          {updatingUserId === user.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : user.is_admin ? (
                            <>
                              <XCircle className="w-4 h-4" />
                              取消权限
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              设为管理员
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
