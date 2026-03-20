import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../src/supabaseClient';
import { Bell, X, User, MessageCircle, Check, XCircle } from 'lucide-react';

interface Message {
  id: number;
  sender_id: string;
  receiver_id: string;
  task_id: string;
  task_title: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender_email?: string;
}

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

interface MessageDropdownProps {
  currentUserId: string;
  onOpenChat?: (chat: {
    taskId: string;
    taskTitle: string;
    otherUserId: string;
    otherUserName: string;
    currentUserId: string;
  }) => void;
}

export const MessageDropdown: React.FC<MessageDropdownProps> = ({ currentUserId, onOpenChat }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'messages' | 'notifications'>('messages');
  const [unreadCount, setUnreadCount] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 加载未读消息和通知
  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        // 加载未读消息数量
        const { count: msgCount, error: msgError } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', currentUserId)
          .eq('is_read', false);

        // 加载未读通知数量
        const { count: notifCount, error: notifError } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', currentUserId)
          .eq('is_read', false);

        if (!msgError && !notifError) {
          setUnreadCount((msgCount || 0) + (notifCount || 0));
        }
      } catch (err) {
        console.error('加载未读数量失败:', err);
      }
    };

    loadUnreadCount();

    // 实时监听新消息
    const msgChannel = supabase
      .channel('messages:notification')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUserId}`
        },
        () => {
          loadUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUserId}`
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    // 实时监听新通知
    const notifChannel = supabase
      .channel('notifications:channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUserId}`
        },
        () => {
          loadUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUserId}`
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(notifChannel);
    };
  }, [currentUserId]);

  // 加载消息列表
  useEffect(() => {
    if (!isOpen || activeTab !== 'messages') return;

    const loadMessages = async () => {
      try {
        // 获取接收的消息
        const { data: receivedData, error: receivedError } = await supabase
          .from('messages')
          .select('*')
          .eq('receiver_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(20);

        // 获取发送的消息
        const { data: sentData, error: sentError } = await supabase
          .from('messages')
          .select('*')
          .eq('sender_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (!receivedError && !sentError) {
          const allMessages = [...(receivedData || []), ...(sentData || [])];
          // 按时间排序并去重（每个对话只显示最新一条）
          const chatMap = new Map();
          allMessages.forEach(msg => {
            const otherUserId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
            const key = `${msg.task_id}_${otherUserId}`;
            if (!chatMap.has(key) || new Date(msg.created_at) > new Date(chatMap.get(key).created_at)) {
              chatMap.set(key, msg);
            }
          });

          setMessages([...chatMap.values()]);
        }
      } catch (err) {
        console.error('加载消息列表失败:', err);
      }
    };

    loadMessages();
  }, [isOpen, activeTab, currentUserId]);

  // 加载通知列表
  useEffect(() => {
    if (!isOpen || activeTab !== 'notifications') return;

    const loadNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error) {
          setNotifications(data || []);
        }
      } catch (err) {
        console.error('加载通知失败:', err);
      }
    };

    loadNotifications();
  }, [isOpen, activeTab, currentUserId]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleOpenChat = (message: Message) => {
    const otherUserId = message.sender_id === currentUserId ? message.receiver_id : message.sender_id;
    // 修复：根据消息方向正确显示对方名称
    // 如果是发送的消息，对方是接收者；如果是接收的消息，对方是发送者
    const otherUserName = message.sender_id === currentUserId
      ? '接收者'
      : (message.sender_email || '接单者');

    if (onOpenChat) {
      onOpenChat({
        taskId: message.task_id,
        taskTitle: message.task_title || '未知任务',
        otherUserId: otherUserId,
        otherUserName: otherUserName,
        currentUserId: currentUserId
      });
    }
    setIsOpen(false);
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markNotificationAsRead(notification.id);
    }
    // 移除自动跳转，避免页面空白
    // 如果需要跳转，可以根据 notification.type 或其他条件来判断
    setIsOpen(false);
  };

  const markNotificationAsRead = async (notificationId: number) => {
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

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return `${Math.floor(diff / 86400000)}天前`;
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
          title="消息"
        >
          <Bell size={20} className="text-slate-400 hover:text-white transition-colors" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 top-12 w-96 bg-[#1e293b] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            {/* 标签页切换 */}
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('messages')}
                  className={`text-sm font-medium px-3 py-1 rounded-full transition-colors ${
                    activeTab === 'messages'
                      ? 'bg-orange-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  聊天
                </button>
                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`text-sm font-medium px-3 py-1 rounded-full transition-colors ${
                    activeTab === 'notifications'
                      ? 'bg-orange-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  通知
                </button>
              </div>
              <div className="text-xs text-slate-400">
                {unreadCount > 0 && `${unreadCount} 条未读`}
              </div>
            </div>

            {/* 内容区域 */}
            <div className="max-h-96 overflow-y-auto">
              {activeTab === 'messages' ? (
                messages.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    <MessageCircle size={40} className="mx-auto mb-3 text-slate-600" />
                    <p className="text-sm">暂无消息</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <button
                      key={msg.id}
                      onClick={() => handleOpenChat(msg)}
                      className={`w-full px-4 py-3 border-b border-slate-800/50 hover:bg-slate-700/30 transition-colors text-left ${
                        !msg.is_read ? 'bg-slate-700/20' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-cyan-900/50 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                          {(msg.sender_id === currentUserId ? '发送至' : msg.sender_email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-sm font-semibold text-white truncate">
                              {msg.sender_id === currentUserId ? `发送至: ${msg.task_title}` : msg.sender_email || '未知用户'}
                            </div>
                            <div className="text-[10px] text-slate-500 shrink-0 ml-2">
                              {formatTime(msg.created_at)}
                            </div>
                          </div>
                          <div className="text-xs text-slate-400 mb-1 truncate">
                            任务：{msg.task_title || '未知任务'}
                          </div>
                          <div className="text-sm text-slate-200 truncate">
                            {msg.content}
                          </div>
                        </div>
                        {!msg.is_read && msg.receiver_id === currentUserId && (
                          <div className="w-2 h-2 bg-orange-500 rounded-full shrink-0 mt-2" />
                        )}
                      </div>
                    </button>
                  ))
                )
              ) : (
                notifications.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    <Bell size={40} className="mx-auto mb-3 text-slate-600" />
                    <p className="text-sm">暂无通知</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`px-4 py-3 border-b border-slate-800/50 cursor-pointer transition-colors hover:bg-slate-700/30 relative ${
                        !notification.is_read ? 'bg-slate-700/20' : ''
                      }`}
                    >
                      <div className="flex gap-3">
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
                            {formatTime(notification.created_at)}
                          </p>
                        </div>
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
                )
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
