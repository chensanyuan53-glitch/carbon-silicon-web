import React, { useState, useEffect } from 'react';
import { supabase } from '../src/supabaseClient';
import { Page } from '../types';
import { Lock, Check, ArrowLeft, AlertCircle } from 'lucide-react';

interface ResetPasswordProps {
  onNavigate: (page: Page) => void;
}

export const ResetPassword: React.FC<ResetPasswordProps> = ({ onNavigate }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type?: 'success' | 'error' | 'info' }>({ visible: false, message: '', type: 'info' });
  const [isValidToken, setIsValidToken] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type }), 3000);
  };

  // 检查 URL 中是否有重置密码的令牌
  useEffect(() => {
    const checkSession = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');
      const error = hashParams.get('error');
      const errorDescription = hashParams.get('error_description');

      console.log('URL hash:', window.location.hash);
      console.log('Reset password params:', { accessToken: !!accessToken, refreshToken: !!refreshToken, type, error });

      // 检查是否有错误参数
      if (error) {
        console.error('Reset link error:', error, errorDescription);
        const errorMsg = errorDescription || '重置密码链接已失效或过期';
        setErrorMessage(errorMsg);
        showToast(errorMsg, 'error');
        setIsLoading(false);
        return; // 让用户看到错误提示，不设置 isValidToken
      }

      if (accessToken && refreshToken && type === 'recovery') {
        try {
          // 设置会话 - 必须同时提供 access_token 和 refresh_token
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error('setSession error:', sessionError);
            showToast(`重置链接已失效或已过期: ${sessionError.message}`, 'error');
            return;
          }

          console.log('Session set successfully', data);
          setIsValidToken(true);
        } catch (err) {
          console.error('setSession exception:', err);
          showToast('重置链接已失效或已过期', 'error');
        }
      } else if (!type && !accessToken) {
        // 检查当前会话是否是恢复会话
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Current session:', !!session);

        if (session) {
          // 检查是否是通过重置链接创建的会话
          // 如果当前有会话，说明可能是从其他地方跳转过来的
          setIsValidToken(true);
        } else {
          showToast('请从邮件中的链接访问此页面', 'info');
        }
      } else {
        console.log('Invalid reset link format');
        showToast('重置链接格式不正确，请重新申请', 'error');
      }

      setIsLoading(false);
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // 验证密码
    if (password.length < 6) {
      showToast('密码长度至少为 6 位', 'error');
      setIsSubmitting(false);
      return;
    }

    if (password !== confirmPassword) {
      showToast('两次输入的密码不一致', 'error');
      setIsSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      showToast('密码重置成功！请使用新密码登录', 'success');

      // 延迟跳转到登录页
      setTimeout(() => {
        onNavigate(Page.REGISTER);
      }, 2000);
    } catch (error: any) {
      console.error('reset password error', error);
      let errorMessage = '重置失败，请稍后重试';

      if (error) {
        const message = error.message?.toLowerCase() || '';
        if (message.includes('weak password')) {
          errorMessage = '密码强度不足，请使用更复杂的密码';
        } else if (message.includes('same password')) {
          errorMessage = '新密码不能与旧密码相同';
        } else if (message.includes('session not found')) {
          errorMessage = '重置链接已失效，请重新申请';
        }
      }

      showToast(errorMessage, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-md w-full relative z-10 bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 shadow-2xl p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-white mb-2">验证链接...</h2>
          <p className="text-slate-400">正在验证重置密码链接</p>
        </div>
      </div>
    );
  }

  if (!isValidToken && (errorMessage || (toast.message && !toast.visible))) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-md w-full relative z-10 bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 shadow-2xl p-8 text-center">
          <AlertCircle size={48} className="mx-auto text-orange-500 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">链接无效</h2>
          <p className="text-slate-400 mb-6">{errorMessage || '重置密码链接已失效或过期'}</p>
          <button
            onClick={() => onNavigate(Page.REGISTER)}
            className="w-full py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition-all"
          >
            返回登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -right-24 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-md w-full relative z-10 bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
        <div className="p-8">
          <div className="text-center mb-8">
            <div className="mx-auto w-12 h-12 rounded bg-gradient-to-tr from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-xl mb-4">
              CS
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              设置新密码
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              请输入您的新密码
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* New Password */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-slate-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  className="appearance-none relative block w-full px-3 py-3 pl-10 border border-slate-600 placeholder-slate-500 text-white bg-slate-900/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm transition-all"
                  placeholder="新密码 (至少 6 位)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={!isValidToken || isSubmitting}
                />
              </div>

              {/* Confirm Password */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Check size={18} className="text-slate-500" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={6}
                  className="appearance-none relative block w-full px-3 py-3 pl-10 border border-slate-600 placeholder-slate-500 text-white bg-slate-900/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm transition-all"
                  placeholder="确认新密码"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  disabled={!isValidToken || isSubmitting}
                />
              </div>
            </div>

            {/* Password Requirements */}
            <div className="bg-slate-900/30 rounded-lg p-4 border border-slate-700/50">
              <p className="text-xs text-slate-400 font-medium mb-2">密码要求:</p>
              <ul className="space-y-1 text-xs text-slate-500">
                <li className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${password.length >= 6 ? 'bg-green-500' : 'bg-slate-600'}`}></span>
                  至少 6 个字符
                </li>
                <li className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${password === confirmPassword && confirmPassword.length > 0 ? 'bg-green-500' : 'bg-slate-600'}`}></span>
                  两次密码输入一致
                </li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={!isValidToken || isSubmitting}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">处理中...</span>
              ) : (
                <span className="flex items-center gap-2">
                  重置密码
                  <Check size={16} className="group-hover:scale-110 transition-transform" />
                </span>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => onNavigate(Page.REGISTER)}
              className="text-sm text-slate-400 hover:text-slate-300 transition-colors flex items-center justify-center gap-1 mx-auto"
            >
              <ArrowLeft size={14} />
              返回登录
            </button>
          </div>
        </div>
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
  );
};
