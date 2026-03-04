import React, { useState, useEffect } from 'react';
import { Bell, X, Check, XCircle } from 'lucide-react';
import { supabase } from '../src/supabaseClient';
import type { Session } from '@supabase/supabase-js';

interface Notification {
  id: number;
  user_id: string;
  type: string;
  title: string;
  content: string;
  related_link?: string;
  is_read: boolean;
  created_at: string;
}

export const NotificationBell: React.FC<{ session: Session | null }> = ({ session }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;

    fetchNotifications();

    // 实时监听新通知
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  const fetchNotifications = async () => {
    if (!session?.user?.id) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('获取通知失败:', error);
        return;
      }

      setNotifications(data || []);
      setUnreadCount((data || []).filter(n => !n.is_read).length);
    } catch (err) {
      console.error('获取通知异常:', err);
    }
  };

  const markAsRead = async (notificationId: number) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('标记已读失败:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!session?.user?.id) return;

    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', session.user.id)
        .eq('is_read', false);

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('全部标记已读失败:', err);
    }
  };

  const deleteNotification = async (notificationId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await supabase.from('notifications').delete().eq('id', notificationId);

      setNotifications(prev => {
        const deleted = prev.find(n => n.id === notificationId);
        setUnreadCount(cnt => deleted && !deleted.is_read ? Math.max(0, cnt - 1) : cnt);
        return prev.filter(n => n.id !== notificationId);
      });
    } catch (err) {
      console.error('删除通知失败:', err);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (notification.related_link) {
      window.location.href = notification.related_link;
    }
    setIsOpen(false);
  };

  if (!session?.user?.id) return null;

  return (
    <>
      {/* 通知铃铛按钮 */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-full border border-slate-600 shadow-lg transition-all hover:scale-105"
        >
          <Bell size={24} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-slate-800 animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* 通知面板 */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-50"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed top-16 right-4 w-96 max-h-[80vh] bg-slate-800 rounded-2xl border border-slate-600 shadow-2xl z-50 overflow-hidden flex flex-col">
            {/* 头部 */}
            <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800">
              <div className="flex items-center gap-2">
                <Bell size={20} className="text-cyan-400" />
                <h3 className="text-lg font-bold text-white">通知</h3>
                {unreadCount > 0 && (
                  <span className="bg-cyan-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <Check size={14} />
                    全部已读
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* 通知列表 */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Bell size={48} className="mb-4 opacity-50" />
                  <p>暂无通知</p>
                </div>
              ) : (
                notifications.map(notification => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 border-b border-slate-700/50 cursor-pointer transition-all hover:bg-slate-700/50 relative ${
                      !notification.is_read ? 'bg-slate-700/30' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* 通知图标 */}
                      <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                        !notification.is_read ? 'bg-cyan-400' : 'bg-slate-500'
                      }`} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className={`font-semibold text-sm truncate ${
                            !notification.is_read ? 'text-white' : 'text-slate-300'
                          }`}>
                            {notification.title}
                          </h4>
                        </div>
                        <p className="text-xs text-slate-400 mb-2 line-clamp-2 leading-relaxed">
                          {notification.content}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(notification.created_at).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>

                      {/* 删除按钮 */}
                      <button
                        onClick={(e) => deleteNotification(notification.id, e)}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1"
                        title="删除"
                      >
                        <XCircle size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};
