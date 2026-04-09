import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Bot, Users, Paperclip, FileText, Image as ImageIcon, Download, File, FolderOpen, AlertTriangle } from 'lucide-react';
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

/** 可能涉及私下交易/引流到站外的表述（接单群风险提示） */
const PRIVATE_DEAL_KEYWORDS = [
  '加微信',
  '私聊转账',
  '加我微信',
  '私下转账',
  '私下交易',
  '线下交易',
  '线下付款',
  '脱离平台',
  '绕过平台',
  '微信转给我',
  '转我微信',
  '私聊付款',
  '加qq',
  '加QQ',
  '加我qq',
  '二维码收款'
];

function textImpliesPrivateDeal(text: string): boolean {
  const s = text.trim();
  if (!s) return false;
  if (PRIVATE_DEAL_KEYWORDS.some((kw) => s.includes(kw))) return true;
  if (/微信\s*[:：]/.test(s)) return true;
  if (/加\s*v\s*信|加vx|加\s*vx|薇信/i.test(s)) return true;
  return false;
}

interface GroupChatFileRecord {
  id: number;
  group_id: number;
  message_id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  mime_type: string;
  uploaded_by: string;
  uploaded_at: string;
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
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const [fileManagerOpen, setFileManagerOpen] = useState(false);
  const [groupFilesList, setGroupFilesList] = useState<GroupChatFileRecord[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [privateDealRiskFlash, setPrivateDealRiskFlash] = useState(false);
  const privateDealRiskTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashPrivateDealRisk = useCallback(() => {
    setPrivateDealRiskFlash(true);
    if (privateDealRiskTimerRef.current) clearTimeout(privateDealRiskTimerRef.current);
    privateDealRiskTimerRef.current = setTimeout(() => {
      setPrivateDealRiskFlash(false);
      privateDealRiskTimerRef.current = null;
    }, 14000);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setPrivateDealRiskFlash(false);
      if (privateDealRiskTimerRef.current) {
        clearTimeout(privateDealRiskTimerRef.current);
        privateDealRiskTimerRef.current = null;
      }
    }
  }, [isOpen]);

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

          if (
            newMsg.message_type === 'text' &&
            textImpliesPrivateDeal(newMsg.content)
          ) {
            flashPrivateDealRisk();
          }

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
  }, [groupChat?.id, flashPrivateDealRisk]);

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

  const loadGroupFiles = useCallback(async () => {
    if (!groupChat?.id) return;
    setFilesLoading(true);
    const { data, error } = await supabase
      .from('group_chat_files')
      .select('*')
      .eq('group_id', groupChat.id)
      .order('uploaded_at', { ascending: false });
    setFilesLoading(false);
    if (!error && data) {
      setGroupFilesList(data as GroupChatFileRecord[]);
    }
  }, [groupChat?.id]);

  const openFileManager = () => {
    setFileManagerOpen(true);
    void loadGroupFiles();
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, 0);
  };

  const handleSendMessage = async () => {
    const content = newMessage.trim();
    if (!content || !groupChat?.id || !currentUserId) return;

    if (textImpliesPrivateDeal(content)) {
      flashPrivateDealRisk();
    }

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

  // 获取文件类型
  const getFileType = (mimeType: string): 'image' | 'document' | 'video' | 'audio' | 'other' => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('excel') || mimeType.includes('powerpoint') || mimeType.includes('text') || mimeType.includes('csv')) return 'document';
    return 'other';
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // 处理文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !groupChat?.id || !currentUserId) return;

    // 检查文件大小（限制50MB）
    if (file.size > 50 * 1024 * 1024) {
      alert('文件大小不能超过50MB');
      return;
    }

    setUploadingFile(true);

    try {
      // 检查用户是否已认证
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('请先登录');
        return;
      }

      // 生成唯一文件名
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;

      // 使用 ArrayBuffer 而非 File：storage-js 对 Blob/File 会走 multipart FormData（空字段名），
      // 部分环境/网关会解析失败并返回 HTML「400 Bad Request」。二进制路径为普通 POST body。
      const fileBuffer = await file.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from('group-chat-files')
        .upload(fileName, fileBuffer, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'application/octet-stream'
        });

      if (uploadError) {
        console.error('上传失败:', uploadError);
        throw new Error(`上传失败: ${uploadError.message}`);
      }

      // 发送文件消息
      const optimisticMessage: GroupMessage = {
        id: -Date.now(),
        group_id: groupChat.id,
        sender_id: currentUserId,
        sender_nickname: userNickname,
        content: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          fileType: getFileType(file.type),
          mimeType: file.type
        }),
        message_type: 'file',
        is_bot: false,
        is_read: false,
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, optimisticMessage]);
      scrollToBottom();

      // 保存文件信息到数据库
      const { data: msgData, error: msgError } = await supabase
        .from('group_messages')
        .insert([{
          group_id: groupChat.id,
          sender_id: currentUserId,
          sender_nickname: userNickname,
          content: optimisticMessage.content,
          message_type: 'file',
          is_bot: false,
          is_read: false
        }])
        .select()
        .single();

      if (msgError) throw msgError;

      // 保存文件信息
      await supabase
        .from('group_chat_files')
        .insert([{
          group_id: groupChat.id,
          message_id: msgData.id,
          file_name: file.name,
          file_path: fileName,
          file_size: file.size,
          file_type: getFileType(file.type),
          mime_type: file.type,
          uploaded_by: currentUserId
        }]);

      if (fileManagerOpen) {
        await loadGroupFiles();
      }

    } catch (err) {
      console.error('文件上传失败:', err);
      alert('文件上传失败，请重试');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const downloadStoredFile = async (filePath: string, displayName: string) => {
    const { data, error } = await supabase.storage
      .from('group-chat-files')
      .createSignedUrl(filePath, 3600);
    if (error) throw error;
    const link = document.createElement('a');
    link.href = data.signedUrl;
    link.download = displayName;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 按消息关联下载（聊天记录里点下载）
  const handleFileDownload = async (content: string, messageId: number) => {
    try {
      const fileInfo = JSON.parse(content) as { fileName?: string };
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (!groupChat?.id) return;

      if (messageId <= 0) {
        alert('消息正在同步，请稍后再试下载');
        return;
      }

      const { data: fileRecord, error } = await supabase
        .from('group_chat_files')
        .select('file_path, file_name')
        .eq('group_id', groupChat.id)
        .eq('message_id', messageId)
        .maybeSingle();

      if (error || !fileRecord) {
        alert('文件不存在或已删除');
        return;
      }

      await downloadStoredFile(fileRecord.file_path, fileInfo.fileName || fileRecord.file_name);
    } catch (err) {
      console.error('文件下载失败:', err);
      alert('文件下载失败，请重试');
    }
  };

  const handleDownloadFromList = async (row: GroupChatFileRecord) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await downloadStoredFile(row.file_path, row.file_name);
    } catch (err) {
      console.error('文件下载失败:', err);
      alert('文件下载失败，请重试');
    }
  };

  // 获取文件图标
  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'image':
        return <ImageIcon size={20} className="text-cyan-400" />;
      case 'document':
        return <FileText size={20} className="text-blue-400" />;
      case 'video':
        return <File size={20} className="text-red-400" />;
      case 'audio':
        return <File size={20} className="text-green-400" />;
      default:
        return <File size={20} className="text-slate-400" />;
    }
  };

  // 获取用户头像URL（从用户文件夹中获取最新头像）
  const getUserAvatarUrl = useCallback(async (userId: string) => {
    try {
      const { data: userFiles, error: listError } = await supabase.storage
        .from('avatars')
        .list(userId, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (listError || !userFiles || userFiles.length === 0) {
        return '';
      }

      // 取最新的一个文件
      const latestFile = userFiles[0];

      // 使用 getPublicUrl 获取公共URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(`${userId}/${latestFile.name}`);

      return publicUrl;
    } catch (err) {
      return '';
    }
  }, []);

  // 批量获取消息发送者的头像
  useEffect(() => {
    const fetchAvatars = async () => {
      if (!messages.length) return;

      const uniqueUserIds = Array.from(
        new Set(messages.map(msg => msg.sender_id).filter(id => id && id !== BOT_USER_ID))
      );

      if (uniqueUserIds.length === 0) return;

      const avatarPromises = uniqueUserIds.map(async userId => {
        const url = await getUserAvatarUrl(userId);
        return { userId, url };
      });

      const results = await Promise.all(avatarPromises);

      const newAvatarUrls: Record<string, string> = {};
      results.forEach(({ userId, url }: { userId: string; url: string }) => {
        if (url) {
          newAvatarUrls[userId] = url;
        }
      });

      setAvatarUrls(prev => ({ ...prev, ...newAvatarUrls }));
    };

    fetchAvatars();
  }, [messages, getUserAvatarUrl]);

  // 获取用户头像背景色（作为备用）
  const getUserAvatarColor = (userId: string | null) => {
    if (!userId) return 'bg-slate-600';
    const colors = [
      'bg-red-500',
      'bg-orange-500',
      'bg-amber-500',
      'bg-green-500',
      'bg-cyan-500',
      'bg-blue-500',
      'bg-indigo-500',
      'bg-purple-500',
      'bg-pink-500',
    ];
    const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  // 获取用户名首字母（作为备用）
  const getUserInitials = (nickname: string | null) => {
    if (!nickname) return '?';
    const trimmed = nickname.trim();
    if (!trimmed) return '?';
    return trimmed.charAt(0).toUpperCase();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div
        className="relative bg-[#1e293b] w-full max-w-2xl rounded-3xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col"
        style={{ height: '85vh', maxHeight: '700px', minHeight: '400px' }}
      >
        {/* 头部 */}
        <div className="bg-[#161e2e] border-b border-slate-700/50 p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">
                {groupChat?.title || '任务交流群'}
              </div>
              <div className="text-xs text-slate-400">
                {loading ? '加载中...' : `${messages.length} 条消息`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={openFileManager}
              disabled={!groupChat?.id || loading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-cyan-300 hover:text-white hover:bg-slate-700/60 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors border border-transparent hover:border-slate-600"
              title="查看本群已上传文件"
            >
              <FolderOpen size={16} />
              文件管理
            </button>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-slate-700/50 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 禁止私下交易 — 常驻提醒 */}
        <div className="shrink-0 px-4 py-2.5 bg-amber-950/35 border-b border-amber-800/25 flex gap-2 items-start">
          <AlertTriangle className="shrink-0 mt-0.5 text-amber-400" size={15} aria-hidden />
          <p className="text-[11px] leading-snug text-amber-100/90">
            <span className="font-semibold text-amber-200">平台提醒：</span>
            请勿脱离平台私下联系、加微信或私聊转账，谨防诈骗与纠纷。消息中出现「加微信」「私聊转账」等表述时，系统会弹出风险提示。
          </p>
        </div>

        {/* 群文件面板 */}
        {fileManagerOpen && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/55 backdrop-blur-[2px]"
            onClick={() => setFileManagerOpen(false)}
            role="presentation"
          >
            <div
              className="bg-[#1e293b] border border-slate-600 rounded-2xl shadow-2xl w-full max-w-md max-h-[min(72vh,520px)] flex flex-col"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="群文件"
            >
              <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-white font-semibold text-sm">
                  <FolderOpen size={18} className="text-cyan-400" />
                  群文件
                  {!filesLoading && (
                    <span className="text-xs font-normal text-slate-400">({groupFilesList.length})</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setFileManagerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-lg"
                  aria-label="关闭"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-[200px] p-2">
                {filesLoading ? (
                  <div className="py-12 text-center text-sm text-slate-500">加载中…</div>
                ) : groupFilesList.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-500">暂无上传文件</div>
                ) : (
                  <ul className="space-y-1">
                    {groupFilesList.map((f) => (
                      <li
                        key={f.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-slate-600/80"
                      >
                        <div className="shrink-0">{getFileIcon(f.file_type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-100 font-medium truncate" title={f.file_name}>
                            {f.file_name}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {formatFileSize(Number(f.file_size))}
                            <span className="mx-1.5">·</span>
                            {new Date(f.uploaded_at).toLocaleString('zh-CN', {
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDownloadFromList(f)}
                          className="shrink-0 p-2 rounded-lg text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300"
                          title="下载"
                        >
                          <Download size={18} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

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
            messages.map((msg) => {
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${msg.sender_id === currentUserId ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* 头像 */}
                  <div className="flex-shrink-0">
                    {msg.is_bot ? (
                      <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center shadow-sm">
                        <Bot size={16} className="text-white" />
                      </div>
                    ) : avatarUrls[msg.sender_id] ? (
                      <>
                        <img
                          src={avatarUrls[msg.sender_id]}
                          alt={msg.sender_nickname || '用户'}
                          className="w-9 h-9 rounded-full object-cover shadow-sm"
                          crossOrigin="anonymous"
                          onError={(e) => {
                            // 图片加载失败时显示默认头像
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                        {/* 备用头像 */}
                        <div className="hidden w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shadow-sm bg-slate-600">
                          ?
                        </div>
                      </>
                    ) : (
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shadow-sm ${getUserAvatarColor(msg.sender_id)}`}
                      >
                        {getUserInitials(msg.sender_nickname)}
                      </div>
                    )}
                  </div>

                  {/* 消息内容区域 */}
                  <div className={`flex flex-col ${msg.sender_id === currentUserId ? 'items-end' : 'items-start'} max-w-[75%]`}>
                    {/* 用户名 */}
                    {(!msg.is_bot || msg.sender_nickname) && (
                      <div className="text-[11px] text-slate-400 mb-1 px-1">
                        {msg.is_bot ? msg.sender_nickname || BOT_NICKNAME : msg.sender_nickname || '用户'}
                      </div>
                    )}

                    {/* 消息气泡 */}
                    <div
                      className={`px-4 py-2.5 ${
                        msg.sender_id === currentUserId
                          ? 'bg-cyan-600 text-white rounded-2xl rounded-tr-sm'
                          : msg.is_bot
                          ? 'bg-purple-600/20 border border-purple-500/30 text-purple-200 rounded-2xl rounded-tl-sm'
                          : 'bg-slate-700 text-slate-200 rounded-2xl rounded-tl-sm'
                      }`}
                    >
                      {msg.message_type === 'system' ? (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {msg.content}
                        </div>
                      ) : msg.message_type === 'file' ? (
                        <>
                          <button
                            onClick={() => void handleFileDownload(msg.content, msg.id)}
                            className="flex items-center gap-3 p-2 bg-black/10 rounded-xl hover:bg-black/20 transition-all cursor-pointer w-full"
                          >
                            {(() => {
                              try {
                                const fileInfo = JSON.parse(msg.content);
                                return (
                                  <>
                                    <div className="flex-shrink-0">
                                      {getFileIcon(fileInfo.fileType)}
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                      <div className="text-sm font-medium text-slate-100 truncate">
                                        {fileInfo.fileName}
                                      </div>
                                      <div className="text-xs text-slate-300">
                                        {formatFileSize(fileInfo.fileSize)}
                                      </div>
                                    </div>
                                    <Download size={16} className="text-slate-300 flex-shrink-0" />
                                  </>
                                );
                              } catch {
                                return <div className="text-sm text-slate-300">文件信息错误</div>;
                              }
                            })()}
                          </button>
                          <div className="text-xs mt-1 opacity-60 text-right">
                            {new Date(msg.created_at).toLocaleTimeString('zh-CN', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm leading-relaxed">
                            {msg.content}
                          </div>
                          <div className="text-xs mt-1 opacity-60 text-right">
                            {new Date(msg.created_at).toLocaleTimeString('zh-CN', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入框 */}
        <div className="border-t border-slate-700/50 bg-[#161e2e]">
          {privateDealRiskFlash && (
            <div className="px-4 pt-3 pb-2 flex gap-2 items-start border-b border-rose-900/40 bg-rose-950/40">
              <AlertTriangle className="shrink-0 text-rose-400 mt-0.5" size={16} aria-hidden />
              <p className="text-xs text-rose-100/95 leading-relaxed">
                <span className="font-semibold text-rose-200">风险提示：</span>
                检测到内容可能涉及私下交易或站外付款。请通过平台流程沟通与结算，勿向陌生人转账、勿轻信代付链接。
              </p>
            </div>
          )}
          <div className="flex gap-3 p-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.mp4,.mov,.mp3,.wav"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile || loading}
              className="px-4 py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-slate-300 rounded-xl transition-colors flex items-center gap-2"
              title="上传文件"
            >
              <Paperclip size={16} />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入消息..."
              className="flex-1 bg-[#0f172a] border border-slate-700/50 rounded-xl px-4 py-3 text-sm outline-none focus:border-cyan-500/50 transition-all text-slate-200"
              disabled={loading || uploadingFile}
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || loading || uploadingFile}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              {uploadingFile ? '上传中...' : <><Send size={16} />发送</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
