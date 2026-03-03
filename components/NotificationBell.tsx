import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { Page } from '../types';
import type { Notification } from '../types/supabase';
import { fetchUnreadCount, fetchNotifications, markAsRead } from '../src/api/notifications';

interface NotificationBellProps {
  userId: string | undefined;
  onNavigate: (page: Page) => void;
}

function formatTime(createdAt: string): string {
  const d = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ userId, onNavigate }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [list, setList] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadUnreadCount = useCallback(async () => {
    if (!userId) return;
    try {
      const count = await fetchUnreadCount(userId);
      setUnreadCount(count);
    } catch (e) {
      console.error('Failed to fetch notification count', e);
    }
  }, [userId]);

  const loadList = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await fetchNotifications(userId);
      setList(data);
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  useEffect(() => {
    if (open && userId) {
      loadList();
      loadUnreadCount();
    }
  }, [open, userId, loadList, loadUnreadCount]);

  useEffect(() => {
    const onFocus = () => loadUnreadCount();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadUnreadCount]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const handleNotificationClick = useCallback(
    async (n: Notification) => {
      try {
        if (!n.is_read) await markAsRead(n.id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setList((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      } catch (e) {
        console.error('Failed to mark as read', e);
      }
      setOpen(false);

      if (n.related_link) {
        if (n.related_link.startsWith('/tasks') || n.related_link.startsWith('tasks')) {
          onNavigate(Page.TASKS);
        } else {
          onNavigate(Page.TASKS);
        }
      }
    },
    [onNavigate]
  );

  if (!userId) return null;

  return (
    <div className="relative flex items-center" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        title="通知"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[80vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">通知</span>
            {unreadCount > 0 && (
              <span className="text-xs text-slate-400">{unreadCount} 条未读</span>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="py-8 text-center text-slate-500 text-sm">加载中...</div>
            ) : list.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">暂无通知</div>
            ) : (
              <ul className="divide-y divide-slate-800">
                {list.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-800/80 transition-colors ${!n.is_read ? 'bg-slate-800/50' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.is_read && (
                          <span className="mt-1.5 w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-white">{n.title}</div>
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.content}</p>
                          <div className="text-[10px] text-slate-500 mt-1">
                            {formatTime(n.created_at)}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
