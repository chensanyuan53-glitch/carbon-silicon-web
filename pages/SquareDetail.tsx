import React, { useState, useEffect } from 'react';
import { ArrowLeft, ThumbsUp, MessageSquare, Share2, Send, X, Trash, Check } from 'lucide-react';
import { supabase } from '../src/supabaseClient';
import { Topic } from '../types';

interface Comment {
  id: number;
  topic_id: number;
  parent_id: number | null;
  user_id: string;
  user_nickname?: string;
  user_avatar_url?: string;
  content: string;
  likes_count: number;
  replies_count: number;
  published: boolean;
  created_at: string;
  updated_at: string;
}

interface SquareDetailProps {
  topicId: string;
  onBack: () => void;
}

export const SquareDetail: React.FC<SquareDetailProps> = ({ topicId, onBack }) => {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string>('');
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // 评论相关
  const [showReplyInput, setShowReplyInput] = useState<number | null>(null);
  const [mainComment, setMainComment] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [likedTopics, setLikedTopics] = useState<Set<number>>(new Set());
  const [likedComments, setLikedComments] = useState<Set<number>>(new Set());

  // Toast notification state
  const [toast, setToast] = useState<{ visible: boolean; message: string; type?: 'success' | 'error' | 'info' }>({ visible: false, message: '', type: 'info' });
  const [copied, setCopied] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type }), duration);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;
    return `${date.getMonth() + 1}-${date.getDate()}`;
  };

  const fetchTopic = async () => {
    try {
      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .eq('id', parseInt(topicId))
        .single();

      if (error) {
        console.error('fetch topic error', error);
        return;
      }
      setTopic(data as Topic);

      // 检查当前用户是否已浏览过此话题
      if (currentUserId) {
        const viewedKey = `viewed_topic_${currentUserId}_${topicId}`;
        const hasViewed = localStorage.getItem(viewedKey);

        // 如果未浏览过,则增加浏览量并标记为已浏览
        if (!hasViewed) {
          await supabase.from('topics').update({ views_count: (data?.views_count || 0) + 1 }).eq('id', parseInt(topicId));
          localStorage.setItem(viewedKey, 'true');
        }
      } else {
        // 未登录用户,基于 sessionStorage 记录(关闭浏览器后会清除)
        const viewedKey = `viewed_topic_${topicId}`;
        const hasViewed = sessionStorage.getItem(viewedKey);

        if (!hasViewed) {
          await supabase.from('topics').update({ views_count: (data?.views_count || 0) + 1 }).eq('id', parseInt(topicId));
          sessionStorage.setItem(viewedKey, 'true');
        }
      }
    } catch (err) {
      console.error('unexpected fetchTopic error', err);
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('topic_id', parseInt(topicId))
        .eq('published', true)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('fetch comments error', error);
        return;
      }
      setComments((data || []) as Comment[]);
    } catch (err) {
      console.error('unexpected fetchComments error', err);
    }
  };

  const checkTopicLike = async () => {
    if (!currentUserId || !topic) return;
    try {
      const { data, error } = await supabase
        .from('topic_likes')
        .select('*')
        .eq('topic_id', topic.id)
        .eq('user_id', currentUserId)
        .single();

      if (!error && data) {
        setLikedTopics(prev => new Set(prev).add(topic.id));
      }
    } catch (err) {
      // 没点赞时会报错，忽略
    }
  };

  const checkCommentLikes = async () => {
    if (!currentUserId || comments.length === 0) return;
    try {
      const { data, error } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', currentUserId)
        .in('comment_id', comments.map(c => c.id));

      if (!error && data) {
        const likedIds = new Set(data.map((item: any) => item.comment_id));
        setLikedComments(likedIds);
      }
    } catch (err) {
      console.error('check comment likes error', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data?.user?.id || null;
      setCurrentUserId(userId);

      // 获取当前用户的头像和昵称
      if (userId) {
        const meta = data?.user?.user_metadata || {};
        const avatarUrl = typeof meta.avatar_url === 'string' ? meta.avatar_url : '';
        const nickname = typeof meta.nickname === 'string' ? meta.nickname : '';
        setCurrentUserAvatar(avatarUrl);
        setCurrentUserName(nickname);
      }

      setLoading(true);

      await Promise.all([
        fetchTopic(),
        fetchComments()
      ]);

      setLoading(false);
    };
    init();
  }, [topicId]);

  useEffect(() => {
    if (currentUserId && topic) {
      checkTopicLike();
    }
  }, [currentUserId, topic]);

  useEffect(() => {
    if (currentUserId && comments.length > 0) {
      checkCommentLikes();
    }
  }, [currentUserId, comments]);

  const handleTopicLike = async () => {
    if (!topic || !currentUserId) {
      showToast('请先登录后点赞', 'info');
      return;
    }
    if (likedTopics.has(topic.id)) {
      // 取消点赞
      const { error } = await supabase
        .from('topic_likes')
        .delete()
        .eq('topic_id', topic.id)
        .eq('user_id', currentUserId);
      if (!error) {
        setLikedTopics(prev => {
          const next = new Set(prev);
          next.delete(topic.id);
          return next;
        });
        setTopic({ ...topic, likes_count: Math.max(0, topic.likes_count - 1) });
      }
    } else {
      // 点赞
      const { error } = await supabase
        .from('topic_likes')
        .insert([{ topic_id: topic.id, user_id: currentUserId }]);
      if (!error) {
        setLikedTopics(prev => new Set(prev).add(topic.id));
        setTopic({ ...topic, likes_count: topic.likes_count + 1 });
      }
    }
  };

  const handleCommentLike = async (commentId: number) => {
    if (!currentUserId) {
      showToast('请先登录后点赞', 'info');
      return;
    }
    if (likedComments.has(commentId)) {
      // 取消点赞
      const { error } = await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', currentUserId);
      if (!error) {
        setLikedComments(prev => {
          const next = new Set(prev);
          next.delete(commentId);
          return next;
        });
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, likes_count: Math.max(0, c.likes_count - 1) } : c));
      }
    } else {
      // 点赞
      const { error } = await supabase
        .from('comment_likes')
        .insert([{ comment_id: commentId, user_id: currentUserId }]);
      if (!error) {
        setLikedComments(prev => new Set(prev).add(commentId));
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, likes_count: c.likes_count + 1 } : c));
      }
    }
  };

  const handleMainCommentSubmit = async () => {
    if (!currentUserId || !topic) {
      showToast('请先登录后评论', 'info');
      return;
    }
    if (!mainComment.trim()) {
      showToast('请输入评论内容', 'error');
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    const meta = (user?.user_metadata ?? {}) as Record<string, any>;
    const userNickname = typeof meta.nickname === 'string' ? meta.nickname : '';
    const userAvatarUrl = typeof meta.avatar_url === 'string' ? meta.avatar_url : '';

    const { error } = await supabase.from('comments').insert([{
      topic_id: topic.id,
      user_id: currentUserId,
      user_nickname: userNickname,
      user_avatar_url: userAvatarUrl,
      content: mainComment.trim(),
      published: true
    }]);
    if (error) {
      console.error('submit comment error', error);
      showToast('评论失败，请稍后重试', 'error');
    } else {
      await fetchComments();
      setMainComment('');
      showToast('评论成功', 'success');
    }
  };

  const handleReplySubmit = async (parentId: number) => {
    if (!currentUserId || !topic) {
      showToast('请先登录后回复', 'info');
      return;
    }
    if (!replyContent.trim()) {
      showToast('请输入回复内容', 'error');
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    const meta = (user?.user_metadata ?? {}) as Record<string, any>;
    const userNickname = typeof meta.nickname === 'string' ? meta.nickname : '';
    const userAvatarUrl = typeof meta.avatar_url === 'string' ? meta.avatar_url : '';

    const { error } = await supabase.from('comments').insert([{
      topic_id: topic.id,
      parent_id: parentId,
      user_id: currentUserId,
      user_nickname: userNickname,
      user_avatar_url: userAvatarUrl,
      content: replyContent.trim(),
      published: true
    }]);
    if (error) {
      console.error('submit reply error', error);
      showToast('回复失败，请稍后重试', 'error');
    } else {
      await fetchComments();
      setReplyContent('');
      setShowReplyInput(null);
      showToast('回复成功', 'success');
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!currentUserId) return;
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', currentUserId);
    if (error) {
      console.error('delete comment error', error);
      showToast('删除失败', 'error');
    } else {
      await fetchComments();
      showToast('删除成功', 'success');
    }
  };

  const handleShare = async () => {
    if (!topic) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?topic=${topic.id}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast('分享链接已复制到剪贴板', 'success');
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      // 如果 clipboard API 不可用，使用备用方法
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        showToast('分享链接已复制到剪贴板', 'success');
        setTimeout(() => setCopied(false), 3000);
      } catch (err) {
        showToast('复制失败，请手动复制链接', 'error');
      }
      document.body.removeChild(textarea);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-lg">加载中...</div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-lg">话题不存在</div>
      </div>
    );
  }

  // 将评论组织成树形结构
  const topLevelComments = comments.filter(c => c.parent_id === null);
  const getReplies = (parentId: number) => comments.filter(c => c.parent_id === parentId);

  return (
    <div className="min-h-screen bg-slate-900 pb-20 pt-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={20} />
            <span>返回</span>
          </button>
        </div>

        {/* Topic Content */}
        <div className="bg-slate-800/80 rounded-2xl p-6 md:p-8 border border-slate-700 mb-8">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-600">
              {topic.user_avatar_url ? (
                <img src={topic.user_avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${topic.user_id}`} alt="avatar" className="w-full h-full object-cover" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm tracking-wide">{topic.user_nickname || '用户'}</span>
                {topic.tag && <span className="text-[10px] bg-cyan-950/40 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/20 font-medium">{topic.tag}</span>}
              </div>
              <span className="text-xs text-slate-500">{formatTime(topic.created_at)}</span>
            </div>
            <span className="text-xs text-cyan-500 bg-cyan-950/30 px-3 py-1 rounded-full border border-cyan-500/10 font-medium">{topic.category}</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-white mb-4 leading-tight">{topic.title}</h1>
          <p className="text-slate-300 text-base leading-relaxed mb-6 whitespace-pre-wrap">{topic.content}</p>

          {topic.image_url && (
            <div className="rounded-xl overflow-hidden border border-slate-700 mb-6">
              <img src={topic.image_url} alt="topic" className="w-full object-cover max-h-96" />
            </div>
          )}

          <div className="flex items-center gap-6 pt-4 border-t border-slate-700/50 text-slate-500 text-sm font-medium">
            <button
              onClick={handleTopicLike}
              className={`flex items-center gap-2 transition-colors ${likedTopics.has(topic.id) ? 'text-cyan-400' : 'hover:text-cyan-400'}`}
            >
              <ThumbsUp size={18} className={likedTopics.has(topic.id) ? 'fill-current' : ''} /> {topic.likes_count}
            </button>
            <button className="flex items-center gap-2 hover:text-cyan-400 transition-colors">
              <MessageSquare size={18} /> {topic.comments_count}
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 hover:text-cyan-400 transition-colors"
            >
              {copied ? <Check size={18} /> : <Share2 size={18} />}
              {copied ? '已复制' : '分享'}
            </button>
            <span className="ml-auto flex items-center gap-2">
              <MessageSquare size={18} /> {topic.views_count} 浏览
            </span>
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-slate-800/80 rounded-2xl p-6 md:p-8 border border-slate-700">
          <h2 className="text-xl font-bold text-white mb-6">评论 ({comments.length})</h2>

          {/* Main Comment Input */}
          {currentUserId && (
            <div className="mb-8 pb-6 border-b border-slate-700/50">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-600 flex-shrink-0">
                  {currentUserAvatar ? (
                    <img src={currentUserAvatar} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId}`} alt="avatar" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1">
                  <textarea
                    value={mainComment}
                    onChange={(e) => setMainComment(e.target.value)}
                    placeholder="发表你的评论..."
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 resize-none"
                  />
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={handleMainCommentSubmit}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
                    >
                      <Send size={16} />
                      发表
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Comments List */}
          <div className="space-y-6">
            {topLevelComments.length === 0 ? (
              <div className="text-center py-12 text-slate-500">暂无评论，快来抢沙发吧！</div>
            ) : (
              topLevelComments.map(comment => (
                <div key={comment.id} className="border-b border-slate-700/50 pb-6 last:border-0 last:pb-0">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-600 flex-shrink-0">
                      {comment.user_avatar_url ? (
                        <img src={comment.user_avatar_url} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.user_id}`} alt="avatar" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-sm">{comment.user_nickname || '用户'}</span>
                          <span className="text-xs text-slate-500">{formatTime(comment.created_at)}</span>
                        </div>
                        {currentUserId === comment.user_id && (
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-slate-500 hover:text-rose-400 transition-colors"
                            title="删除评论"
                          >
                            <Trash size={14} />
                          </button>
                        )}
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed mb-3">{comment.content}</p>
                      <div className="flex items-center gap-4 text-slate-500 text-xs">
                        <button
                          onClick={() => handleCommentLike(comment.id)}
                          className={`flex items-center gap-1 transition-colors ${likedComments.has(comment.id) ? 'text-cyan-400' : 'hover:text-cyan-400'}`}
                        >
                          <ThumbsUp size={14} className={likedComments.has(comment.id) ? 'fill-current' : ''} /> {comment.likes_count}
                        </button>
                        <button
                          onClick={() => setShowReplyInput(showReplyInput === comment.id ? null : comment.id)}
                          className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
                        >
                          <MessageSquare size={14} /> 回复
                        </button>
                      </div>

                      {/* Reply Input */}
                      {showReplyInput === comment.id && currentUserId && (
                        <div className="mt-4 p-4 bg-slate-900/50 rounded-lg">
                          <div className="flex items-start gap-2">
                            <textarea
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              placeholder={`回复 ${comment.user_nickname || '用户'}...`}
                              rows={2}
                              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 resize-none"
                            />
                            <button
                              onClick={() => handleReplySubmit(comment.id)}
                              className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
                            >
                              发送
                            </button>
                          </div>
                          <button
                            onClick={() => setShowReplyInput(null)}
                            className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            取消
                          </button>
                        </div>
                      )}

                      {/* Replies */}
                      {getReplies(comment.id).length > 0 && (
                        <div className="mt-4 space-y-4 pl-4 border-l-2 border-slate-700/50">
                          {getReplies(comment.id).map(reply => (
                            <div key={reply.id} className="flex gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-600 flex-shrink-0">
                                {reply.user_avatar_url ? (
                                  <img src={reply.user_avatar_url} alt="avatar" className="w-full h-full object-cover" />
                                ) : (
                                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${reply.user_id}`} alt="avatar" className="w-full h-full object-cover" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-white font-bold text-xs">{reply.user_nickname || '用户'}</span>
                                    <span className="text-xs text-slate-500">{formatTime(reply.created_at)}</span>
                                  </div>
                                  {currentUserId === reply.user_id && (
                                    <button
                                      onClick={() => handleDeleteComment(reply.id)}
                                      className="text-slate-500 hover:text-rose-400 transition-colors"
                                    >
                                      <Trash size={12} />
                                    </button>
                                  )}
                                </div>
                                <p className="text-slate-300 text-xs leading-relaxed mb-2">{reply.content}</p>
                                <button
                                  onClick={() => handleCommentLike(reply.id)}
                                  className={`text-xs flex items-center gap-1 transition-colors ${likedComments.has(reply.id) ? 'text-cyan-400' : 'hover:text-cyan-400'}`}
                                >
                                  <ThumbsUp size={12} className={likedComments.has(reply.id) ? 'fill-current' : ''} /> {reply.likes_count}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
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
