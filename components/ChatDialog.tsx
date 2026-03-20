import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../src/supabaseClient';
import { X, Send, User } from 'lucide-react';

interface Message {
  id: number;
  sender_id: string;
  receiver_id: string;
  task_id: string;
  task_title: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface ChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
  otherUserId: string;
  otherUserName?: string;
  currentUserId: string;
}

export const ChatDialog: React.FC<ChatDialogProps> = ({
  isOpen,
  onClose,
  taskId,
  taskTitle,
  otherUserId,
  otherUserName,
  currentUserId
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [senderEmail, setSenderEmail] = useState('');

  // 获取当前用户邮箱
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setSenderEmail(user.email || '');
        }
      } catch (err) {
        console.error('获取用户信息失败:', err);
      }
    };
    getCurrentUser();
  }, []);

  // 加载消息
  useEffect(() => {
    if (!isOpen || !taskId) return;

    const loadMessages = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('task_id', taskId)
          .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
          .order('created_at', { ascending: true });

        if (!error && data) {
          setMessages(data);
          scrollToBottom();
        }
      } catch (err) {
        console.error('加载消息失败:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();

    // 标记消息为已读
    const markAsRead = async () => {
      try {
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('receiver_id', currentUserId)
          .eq('task_id', taskId)
          .eq('is_read', false);
      } catch (err) {
        console.error('标记已读失败:', err);
      }
    };

    markAsRead();
  }, [isOpen, taskId, currentUserId, otherUserId]);

  // 实时监听新消息
  useEffect(() => {
    if (!isOpen || !taskId || !currentUserId) return;

    const channel = supabase
      .channel(`messages:${taskId}:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `task_id=eq.${taskId}`
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // 只显示发送给当前用户或当前用户发送的消息
          if (
            newMsg.sender_id === currentUserId ||
            newMsg.receiver_id === currentUserId
          ) {
            setMessages(prev => [...prev, newMsg]);
            scrollToBottom();

            // 如果是接收到的消息，标记为已读
            if (newMsg.receiver_id === currentUserId) {
              supabase
                .from('messages')
                .update({ is_read: true })
                .eq('id', newMsg.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, taskId, currentUserId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const { error } = await supabase.from('messages').insert([{
        sender_id: currentUserId,
        receiver_id: otherUserId,
        sender_email: senderEmail,
        task_id: taskId,
        task_title: taskTitle,
        content: newMessage.trim(),
        is_read: false
      }]);

      if (error) throw error;

      setNewMessage('');
    } catch (err) {
      console.error('发送消息失败:', err);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#1e293b] w-full max-w-2xl rounded-3xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col" style={{ height: '85vh', maxHeight: '700px', minHeight: '400px' }}>
        {/* 头部 */}
        <div className="bg-[#161e2e] border-b border-slate-700/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-900/50 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold">
              {otherUserName?.charAt(0).toUpperCase() || <User size={20} />}
            </div>
            <div>
              <div className="text-sm font-semibold text-white">
                {otherUserName || '对方'}
              </div>
              <div className="text-xs text-slate-400 truncate max-w-[200px]">
                任务：{taskTitle}
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
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              加载消息中...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center">
                <div className="mb-2">
                  <Send size={48} className="mx-auto text-slate-600" />
                </div>
                <p>开始聊天吧！</p>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_id === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] ${
                    isMine ? 'items-end' : 'items-start'
                  } flex flex-col`}>
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        isMine
                          ? 'bg-orange-500 text-white rounded-br-none'
                          : 'bg-slate-700 text-slate-200 rounded-bl-none'
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                    <div className={`text-[10px] text-slate-500 mt-1 ${
                      isMine ? 'text-right' : 'text-left'
                    }`}>
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入框 */}
        <div className="border-t border-slate-700/50 p-4 bg-[#161e2e]">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="输入消息..."
              className="flex-1 bg-[#0f172a] border border-slate-700/50 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-500/50 transition-all text-slate-200"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              {sending ? (
                <span>发送中...</span>
              ) : (
                <>
                  <Send size={16} />
                  发送
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
