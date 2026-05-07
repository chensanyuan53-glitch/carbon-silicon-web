import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../src/supabaseClient';
import { Bell, X, User, MessageCircle, Check, XCircle, Users } from 'lucide-react';

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
  sender_nickname?: string;
  is_group_chat?: boolean;
  group_id?: number;
  /** 群聊消息类型，用于预览（如 file 需解析 JSON） */
  message_type?: string;
}

/** 铃铛/消息列表里群聊最后一条话的摘要 */
function formatGroupChatPreviewSnippet(content: string, messageType?: string | null): string {
  if (messageType === 'file') {
    try {
      const info = JSON.parse(content) as { fileName?: string };
      const name = typeof info.fileName === 'string' ? info.fileName : '文件';
      return `[文件] ${name}`;
    } catch {
      const dq = content.match(/"fileName"\s*:\s*"([^"]*)"/);
      if (dq) return `[文件] ${dq[1]}`;
      const sq = content.match(/'fileName'\s*:\s*'([^']*)'/);
      if (sq) return `[文件] ${sq[1]}`;
      return '[文件]';
    }
  }
  if (messageType === 'system') {
    return content.length > 80 ? `${content.slice(0, 80)}…` : content;
  }
  return content;
}

interface Notification {
  id: number;
  user_id: string;
  type: string;
  title: string;
  content: string;
  related_id?: string;
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
  onOpenGroupChat?: (chat: {
    taskId: string;
    taskTitle: string;
    currentUserId: string;
  }) => void;
  onTaskCompletionRequest?: (taskId: string) => void;
}

export const MessageDropdown: React.FC<MessageDropdownProps> = ({ currentUserId, onOpenChat, onOpenGroupChat, onTaskCompletionRequest }) => {
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
        // 加载未读私聊消息数量
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

        // 加载群聊未读消息数量
        // 获取用户参与的所有群聊
        const { data: memberGroups } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', currentUserId);

        let groupMsgCount = 0;
        if (memberGroups && memberGroups.length > 0) {
          const groupIds = memberGroups.map(m => m.group_id);

          // 统计这些群聊中未读且不是自己发送的消息
          const { count, error } = await supabase
            .from('group_messages')
            .select('*', { count: 'exact', head: true })
            .in('group_id', groupIds)
            .eq('is_read', false)
            .neq('sender_id', currentUserId);

          if (!error) {
            groupMsgCount = count || 0;
          }
        }

        if (!msgError && !notifError) {
          setUnreadCount((msgCount || 0) + (notifCount || 0) + groupMsgCount);
        }
      } catch (err) {
        // 忽略加载错误
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

    // 实时监听群聊消息
    const groupMsgChannel = supabase
      .channel('group_messages:notification')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages'
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
          table: 'group_messages'
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(groupMsgChannel);
    };
  }, [currentUserId]);

  // 加载消息列表
  useEffect(() => {
    if (!isOpen || activeTab !== 'messages') return;

    const loadMessages = async () => {
      try {
        // 获取接收的私聊消息
        const { data: receivedData, error: receivedError } = await supabase
          .from('messages')
          .select('*')
          .eq('receiver_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(20);

        // 获取发送的私聊消息
        const { data: sentData, error: sentError } = await supabase
          .from('messages')
          .select('*')
          .eq('sender_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(20);

        // 获取群聊消息
        // 先获取用户参与的所有群聊
        const { data: memberGroups } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', currentUserId);

        let groupMessages = [];
        if (memberGroups && memberGroups.length > 0) {
          const groupIds = memberGroups.map(m => m.group_id);
          // 获取这些群聊的最新消息
          const { data: groupMsgs } = await supabase
            .from('group_messages')
            .select('*, group_chats!inner(task_id, title)')
            .in('group_id', groupIds)
            .order('created_at', { ascending: false })
            .limit(20);

          if (groupMsgs) {
            // 转换为消息格式，兼容现有UI
            groupMessages = groupMsgs.map(msg => ({
              id: msg.id,
              sender_id: msg.sender_id,
              receiver_id: '', // 群聊没有接收者
              task_id: msg.group_chats?.task_id || '',
              task_title: msg.group_chats?.title || '群聊',
              content: msg.content,
              is_read: msg.is_read,
              created_at: msg.created_at,
              sender_nickname: msg.sender_nickname,
              is_group_chat: true, // 标记为群聊
              group_id: msg.group_id,
              message_type: msg.message_type
            }));
          }
        }

        if (!receivedError && !sentError) {
          const privateMessages = [...(receivedData || []), ...(sentData || [])];

          // 收集所有有群聊的任务ID
          const tasksWithGroupChat = new Set<string>();
          groupMessages.forEach(msg => {
            if (msg.task_id) {
              tasksWithGroupChat.add(msg.task_id);
            }
          });

          // 过滤掉有群聊的私聊消息
          const filteredPrivateMessages = privateMessages.filter(msg =>
            !tasksWithGroupChat.has(msg.task_id)
          );

          // 合并私聊和群聊消息
          const allMessages = [...filteredPrivateMessages, ...groupMessages];

          // 按时间排序并去重
          const chatMap = new Map();
          allMessages.forEach(msg => {
            // 对于群聊，使用 group_id 作为唯一标识
            // 对于私聊，使用 task_id + otherUserId 作为唯一标识
            let key;
            if ((msg as any).is_group_chat) {
              key = `group_${(msg as any).group_id}`;
            } else {
              const otherUserId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
              key = `${msg.task_id}_${otherUserId}`;
            }

            if (!chatMap.has(key) || new Date(msg.created_at) > new Date(chatMap.get(key).created_at)) {
              chatMap.set(key, msg);
            }
          });

          setMessages([...chatMap.values()]);
        }
      } catch (err) {
        // 忽略加载错误
      }
    };

    loadMessages();

    // 实时监听私聊消息
    const privateChannel = supabase
      .channel('messages:list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `or(receiver_id.eq.${currentUserId},sender_id.eq.${currentUserId})`
        },
        () => loadMessages()
      )
      .subscribe();

    // 实时监听群聊消息
    const groupChannel = supabase
      .channel('group_messages:list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_messages'
        },
        () => loadMessages()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(privateChannel);
      supabase.removeChannel(groupChannel);
    };
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
        // 忽略加载错误
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

  const handleOpenChat = async (message: Message) => {
    // 如果是群聊消息，直接打开群聊
    if (message.is_group_chat && onOpenGroupChat) {
      onOpenGroupChat({
        taskId: message.task_id,
        taskTitle: message.task_title || '未知任务',
        currentUserId: currentUserId
      });
      setIsOpen(false);
      return;
    }

    // 如果是私聊消息，先检查是否有群聊
    try {
      const { data: groupChat } = await supabase
        .from('group_chats')
        .select('*')
        .eq('task_id', message.task_id)
        .single();

      // 如果有群聊，打开群聊
      if (groupChat && onOpenGroupChat) {
        onOpenGroupChat({
          taskId: message.task_id,
          taskTitle: message.task_title || '未知任务',
          currentUserId: currentUserId
        });
        setIsOpen(false);
        return;
      }
    } catch (err) {
      // 没有找到群聊，打开私聊
    }

    // 没有群聊，打开私聊
    const otherUserId = message.sender_id === currentUserId ? message.receiver_id : message.sender_id;
    const otherUserName = message.sender_id === currentUserId
      ? '接收者'
      : (message.sender_nickname || message.sender_email || '接单者');

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

    // 处理新话题通知，跳转到相关链接
    if (notification.type === 'new_topic' && notification.related_link) {
      window.location.href = notification.related_link;
      setIsOpen(false);
      return;
    }

    // 处理任务完成确认请求
    if (notification.type === 'task_completion' && onTaskCompletionRequest) {
      onTaskCompletionRequest(notification.related_id || '');
      setIsOpen(false);
      return;
    }

    // 处理组队申请通知
    if (notification.type === 'team_join_request' && notification.related_link) {
      window.location.href = notification.related_link;
      setIsOpen(false);
      return;
    }

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
      // 忽略错误
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
      // 忽略错误
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
      <div className="relative z-50" ref={dropdownRef}>
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
          <div className="absolute right-0 top-12 z-50 w-96 bg-[#1e293b] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
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
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          msg.is_group_chat
                            ? 'bg-purple-900/50 text-purple-400 border border-purple-500/30'
                            : 'bg-cyan-900/50 text-cyan-400 border border-cyan-500/30'
                        }`}>
                          {msg.is_group_chat ? (
                            <Users size={16} />
                          ) : msg.sender_id === currentUserId ? (
                            '发送至'
                          ) : (
                            (msg.sender_nickname || msg.sender_email || '?').charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-sm font-semibold text-white truncate">
                              {msg.is_group_chat ? (
                                `${msg.task_title} (群聊)`
                              ) : msg.sender_id === currentUserId ? (
                                `发送至: ${msg.task_title}`
                              ) : (
                                (msg.sender_nickname || msg.sender_email || '未知用户')
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 shrink-0 ml-2">
                              {formatTime(msg.created_at)}
                            </div>
                          </div>
                          <div className="text-xs text-slate-400 mb-1 truncate">
                            {msg.is_group_chat ? (
                              `${msg.sender_nickname || '用户'}: ${formatGroupChatPreviewSnippet(msg.content, msg.message_type)}`
                            ) : (
                              `任务：${msg.task_title || '未知任务'}`
                            )}
                          </div>
                          {!msg.is_group_chat && (
                            <div className="text-sm text-slate-200 truncate">
                              {msg.content}
                            </div>
                          )}
                        </div>
                        {!msg.is_read && (msg.receiver_id === currentUserId || msg.is_group_chat) && (
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
