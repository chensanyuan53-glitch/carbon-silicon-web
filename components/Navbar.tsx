import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Page } from '../types';
import type { Session } from '@supabase/supabase-js'; // 使用 type 导入仅类型，避免运行时问题
import { supabase } from '../src/supabaseClient';
import {
  LayoutGrid,
  Trophy,
  Briefcase,
  MessageSquare, 
  ShoppingBag, 
  User,
  LogOut // 3. 引入退出图标
} from 'lucide-react';

interface NavbarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  session: Session | null; // 4. 这里必须接收 session！
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate, session }) => {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const profile = useMemo(() => {
    const email = session?.user.email ?? '';
    const meta = (session?.user.user_metadata ?? {}) as Record<string, any>;
    return {
      email,
      contact: typeof meta.contact === 'string' ? meta.contact : '',
      role: typeof meta.role === 'string' ? meta.role : '',
      domains: Array.isArray(meta.domains) ? meta.domains.filter((d) => typeof d === 'string') : [],
      skills: typeof meta.skills === 'string' ? meta.skills : '',
    };
  }, [session]);

  const navItems = [
    { id: Page.STATION, label: '情报站', icon: LayoutGrid },
    { id: Page.ARENA, label: '竞技场', icon: Trophy },
    { id: Page.TASKS, label: '任务大厅', icon: Briefcase },
    { id: Page.SQUARE, label: '广场', icon: MessageSquare },
    { id: Page.MARKET, label: '成果市集', icon: ShoppingBag },
  ];

  // 5. 处理退出登录的逻辑
  const handleLogout = async () => {
    await supabase.auth.signOut();
    // 退出后可以选择留在当前页，或者跳回首页，这里演示不做跳转或跳回首页
    setIsAccountMenuOpen(false);
    onNavigate(Page.HOME);
  };

  useEffect(() => {
    if (!isAccountMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!accountMenuRef.current) return;
      if (!accountMenuRef.current.contains(e.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [isAccountMenuOpen]);

  return (
    <nav className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div 
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onNavigate(Page.HOME)}
          >
            <div className="w-8 h-8 rounded bg-gradient-to-tr from-orange-500 to-red-500 flex items-center justify-center text-white font-bold">
              C-Si
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              碳硅合创
            </span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                  currentPage === item.id
                    ? 'text-cyan-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
          </div>

          {/* User Actions */}
          <div className="flex items-center gap-4">
            {/* 6. 核心修改：根据是否登录显示不同内容 */}
            {session ? (
              // === 如果已登录 (session存在) ===
              <div className="relative flex items-center pl-2 border-l border-slate-700" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsAccountMenuOpen((v) => !v)}
                  className="flex items-center gap-2"
                  title="我的账号"
                >
                  {/* 显示用户邮箱 (大屏显示) */}
                  <span className="text-xs text-slate-400 hidden lg:block max-w-48 truncate">
                    {profile.email}
                  </span>

                  {/* 用户头像（登录态变色） */}
                  <div className="w-8 h-8 rounded-full bg-cyan-900/50 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold text-xs select-none">
                    {profile.email?.charAt(0).toUpperCase()}
                  </div>
                </button>

                {isAccountMenuOpen && (
                  <div className="absolute right-0 top-12 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-800">
                      <div className="text-sm font-semibold text-white truncate">{profile.email}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {profile.role ? `身份：${profile.role === 'carbon' ? '行业专家' : profile.role === 'silicon' ? 'AI 探索者' : profile.role}` : '身份：未填写'}
                      </div>
                    </div>

                    <div className="px-4 py-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">联系方式</span>
                        <span className="text-slate-200 truncate">{profile.contact || '未填写'}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">关注领域</span>
                        <span className="text-slate-200 truncate">
                          {profile.domains.length ? profile.domains.join('、') : '未填写'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">技能</span>
                        <span className="text-slate-200 truncate">{profile.skills || '未填写'}</span>
                      </div>
                    </div>

                    <div className="px-2 py-2 border-t border-slate-800">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-red-400 transition-colors"
                      >
                        <LogOut size={16} />
                        退出登录
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // === 如果未登录 (session为空) ===
              <div 
                onClick={() => onNavigate(Page.REGISTER)}
                className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-cyan-500 transition-all"
                title="注册 / 登录"
              >
                <User size={16} className="text-slate-300" />
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};