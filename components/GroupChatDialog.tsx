import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, Users } from 'lucide-react';
import { supabase } from '../src/supabaseClient';
import {
  GroupChat,
  GroupMessage,
  getGroupChat,
  getGroupMembers,
  BOT_USER_ID,
  BOT_NICKNAME
} from '../src/botService';

interface GroupChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  currentUserId: string | null;
}

export const GroupChatDialog: React.FC<GroupChatDialogProps> = ({
  isOpen,
  onClose,
  taskId,
  currentUserId
}) => {
  const [groupChat, setGroupChat] = useState<GroupChat | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userNickname, setUserNickname] = useState('');

  // 获取当前用户昵称
  useEffect(() => {
    const getUserInfo = async () => {
      if (!currentUserId) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const meta = user.user_metadata || {};
        setUserNickname(meta.nickname || user.email || '用户');
      }
    };
    getUserInfo();
  }, [currentUserId]);

  // 加载群聊信息和消息（并行请求）
  useEffect(() => {
    const loadData = async () => {
      if (!isOpen || !taskId) return;

      setLoading(true);
      try {
        // 并行加载群聊信息和消息
        const [groupChatResult, messagesResult] = await Promise.all([
          supabase
            .from('group_chats')
            .select('*')
            .eq('task_id', taskId)
            .single(),
          // 预先获取消息，需要先获取groupChat.id
          supabase
            .from('group_chats')
            .select('id')
            .eq('task_id', taskId)
            .single()
        ]);

        if (groupChatResult.error) {
          return;
        }

        if (groupChatResult.data) {
          const chatData = groupChatResult.data as GroupChat;
          setGroupChat(chatData);

          // 加载消息
          const { data: messagesData, error: messagesError } = await supabase
            .from('group_messages')
            .select('*')
            .eq('group_id', chatData.id)
            .order('created_at', { ascending: true });

          if (!messagesError && messagesData) {
            // 一次性设置消息并滚动，避免中间状态
            setMessages(messagesData as GroupMessage[]);

            // 使用 setTimeout 延迟滚动，确保 DOM 完全渲染
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            }, 100);

            // 标记所有未读消息为已读
            const unreadMessages = messagesData.filter(msg => !msg.is_read && msg.sender_id !== currentUserId);
            if (unreadMessages.length > 0) {
              supabase
                .from('group_messages')
                .update({ is_read: true })
                .eq('group_id', chatData.id)
                .eq('is_read', false)
                .neq('sender_id', currentUserId)
                .then();
            }
          }
        }
      } catch (err) {
        // 忽略加载错误
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, taskId, currentUserId]);

  // 实时监听新消息
  useEffect(() => {
    if (!groupChat?.id) return;

    const channel = supabase
      .channel(`group_messages:${groupChat.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupChat.id}`
        },
        (payload) => {
          const newMsg = payload.new as GroupMessage;

          // 更新消息列表：移除临时消息，添加真实消息
          setMessages(prev => {
            const filtered = prev.filter(m => m.id > 0); // 移除临时消息（负数ID）
            // 检查消息是否已存在，避免重复
            const exists = filtered.some(m => m.id === newMsg.id);
            if (!exists) {
              return [...filtered, newMsg];
            }
            return filtered;
          });
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupChat?.id]);

  // 确保对话框完全渲染后滚动到底部
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      // 多次尝试滚动，确保 DOM 完全渲染
      const scrollAttempts = [0, 50, 100];
      scrollAttempts.forEach(delay => {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }, delay);
      });
    }
  }, [isOpen, messages.length]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, 0);
  };

  const handleSendMessage = async () => {
    const content = newMessage.trim();
    if (!content || !groupChat?.id || !currentUserId) return;

    // 乐观更新：立即显示发送的消息
    const optimisticMessage: GroupMessage = {
      id: -Date.now(), // 使用负数作为临时ID，这样可以轻松识别
      group_id: groupChat.id,
      sender_id: currentUserId,
      sender_nickname: userNickname,
      content,
      message_type: 'text',
      is_bot: false,
      is_read: false,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    scrollToBottom();

    // 发送到服务器
    const { error } = await supabase
      .from('group_messages')
      .insert([{
        group_id: groupChat.id,
        sender_id: currentUserId,
        sender_nickname: userNickname,
        content,
        message_type: 'text',
        is_bot: false,
        is_read: false
      }]);

    if (error) {
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      setNewMessage(content);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1e293b] w-full max-w-2xl rounded-3xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col" style={{ height: '85vh', maxHeight: '700px', minHeight: '400px' }}>
        {/* 头部 */}
        <div className="bg-[#161e2e] border-b border-slate-700/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <Users size={20} />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">
                {groupChat?.title || '任务交流群'}
              </div>
              <div className="text-xs text-slate-400">
                {loading ? '加载中...' : `${messages.length} 条消息`}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-slate-700/50 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              加载消息中...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center">
                <div className="mb-2">
                  <Send size={48} className="mx-auto text-slate-600" />
                </div>
                <p>开始交流吧！</p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.sender_id === currentUserId
                      ? 'bg-cyan-600 text-white rounded-tr-none'
                      : msg.is_bot
                      ? 'bg-purple-600/20 border border-purple-500/30 text-purple-200 rounded-tl-none'
                      : 'bg-slate-700 text-slate-200 rounded-tl-none'
                  }`}
                >
                  {msg.is_bot && (
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-purple-500/20">
                      <Bot size={16} className="text-purple-400" />
                      <span className="text-xs font-semibold text-purple-400">
                        {msg.sender_nickname || BOT_NICKNAME}
                      </span>
                    </div>
                  )}
                  {msg.message_type === 'system' ? (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {msg.content}
                    </div>
                  ) : (
                    <>
                      {!msg.is_bot && (
                        <div className="text-xs mb-1 text-slate-400">
                          {msg.sender_nickname || '用户'}
                        </div>
                      )}
                      <div className="text-sm leading-relaxed">
                        {msg.content}
                      </div>
                      <div className="text-xs mt-1 opacity-60">
                        {new Date(msg.created_at).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入框 */}
        <div className="border-t border-slate-700/50 p-4 bg-[#161e2e]">
          <div className="flex gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入消息..."
              className="flex-1 bg-[#0f172a] border border-slate-700/50 rounded-xl px-4 py-3 text-sm outline-none focus:border-cyan-500/50 transition-all text-slate-200"
              disabled={loading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || loading}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              <Send size={16} />
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
