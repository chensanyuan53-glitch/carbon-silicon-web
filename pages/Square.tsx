import React, { useState, useEffect } from 'react';
import { MessageSquare, ThumbsUp, Eye, Share2, Plus, Hash, ArrowUpRight, X, Image, Trash, Check, Copy } from 'lucide-react';
import { supabase } from '../src/supabaseClient';
import { Topic, HotTopic, RecommendedUser } from '../types';

interface SquareProps {
  onTopicSelect: (topicId: string) => void;
}

export const Square: React.FC<SquareProps> = ({ onTopicSelect }) => {
  const categories = ['#脑洞大开', '#避坑指南', '#求组队', '#行业吐槽', '#工具测评'];
  const [topics, setTopics] = useState<Topic[]>([]);
  const [hotTopics, setHotTopics] = useState<HotTopic[]>([]);
  const [recommendedUsers, setRecommendedUsers] = useState<RecommendedUser[]>([]);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Topic | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    content: '',
    image_url: '',
    category: '#脑洞大开',
    tag: ''
  });

  // Toast notification state
  const [toast, setToast] = useState<{ visible: boolean; message: string; type?: 'success' | 'error' | 'info' }>({ visible: false, message: '', type: 'info' });
  const [copiedTopicId, setCopiedTopicId] = useState<number | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type }), duration);
  };

  // 复制分享链接
  const handleShare = async (e: React.MouseEvent, topicId: number) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}${window.location.pathname}?topic=${topicId}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedTopicId(topicId);
      showToast('分享链接已复制到剪贴板', 'success');
      setTimeout(() => setCopiedTopicId(null), 3000);
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
        setCopiedTopicId(topicId);
        showToast('分享链接已复制到剪贴板', 'success');
        setTimeout(() => setCopiedTopicId(null), 3000);
      } catch (err) {
        showToast('复制失败，请手动复制链接', 'error');
      }
      document.body.removeChild(textarea);
    }
  };

  const fetchTopics = async () => {
    try {
      const { data, error } = await supabase
        .from('topics')
        .select('id, user_id, title, content, image_url, category, tag, likes_count, comments_count, views_count, published, created_at, updated_at')
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        console.error('fetch topics error', error);
        return;
      }
      setTopics((data || []) as Topic[]);
    } catch (err) {
      console.error('unexpected fetchTopics error', err);
    }
  };

  const fetchHotTopics = async () => {
    try {
      const { data, error } = await supabase
        .from('hot_topics')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true })
        .limit(10);
      if (error) {
        console.error('fetch hot topics error', error);
        return;
      }
      setHotTopics((data || []) as HotTopic[]);
    } catch (err) {
      console.error('unexpected fetchHotTopics error', err);
    }
  };

  const fetchRecommendedUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('recommended_users')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true })
        .limit(5);
      if (error) {
        console.error('fetch recommended users error', error);
        return;
      }
      setRecommendedUsers((data || []) as RecommendedUser[]);
    } catch (err) {
      console.error('unexpected fetchRecommendedUsers error', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data?.user?.id || null);
      await fetchTopics();
      await fetchHotTopics();
      await fetchRecommendedUsers();
    };
    init();
  }, []);

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

  const handlePublish = async () => {
    const { data, error: userErr } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) {
      showToast('请先登录后发布话题', 'info');
      return;
    }
    if (!form.title || !form.content) {
      showToast('请填写标题和内容', 'error');
      return;
    }
    const { error } = await supabase.from('topics').insert([{
      title: form.title,
      content: form.content,
      image_url: form.image_url || null,
      category: form.category,
      tag: form.tag || null,
      user_id: user.id,
      published: true
    }]);
    if (error) {
      console.error('publish topic error', error);
      showToast('发布失败，请稍后重试', 'error');
    } else {
      await fetchTopics();
      setShowPublishModal(false);
      setForm({ title: '', content: '', image_url: '', category: '#脑洞大开', tag: '' });
      showToast('发布成功', 'success');
    }
  };

  const handleDelete = async (e: React.MouseEvent, topic: Topic) => {
    e.stopPropagation();
    setDeleteTarget(topic);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !currentUserId) return;
    const { error } = await supabase
      .from('topics')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('user_id', currentUserId);
    if (error) {
      console.error('delete topic error', error);
      showToast('删除失败，请稍后重试', 'error');
    } else {
      await fetchTopics();
      setShowDeleteModal(false);
      setDeleteTarget(null);
      showToast('删除成功', 'success');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 pb-20 pt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header with Search and Create */}
        <div className="flex justify-between items-center mb-10">
           <div className="flex flex-col md:flex-row md:items-center gap-4">
              <h1 className="text-3xl font-bold text-white tracking-tight">碳硅广场</h1>
              <div className="hidden md:flex gap-2">
                 {categories.map(tag => (
                   <span key={tag} className="px-3 py-1.5 bg-slate-800 text-slate-400 text-xs font-medium rounded-full border border-slate-700 cursor-pointer hover:bg-slate-700 hover:text-white transition-colors">{tag}</span>
                 ))}
              </div>
           </div>
           <button
             onClick={() => {
               if (!currentUserId) {
                 showToast('请先登录后发布话题', 'info');
                 return;
               }
               setShowPublishModal(true);
             }}
             className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20 hover:scale-105"
           >
              <Plus size={18} />
              <span className="hidden sm:inline">发布话题</span>
           </button>
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

        {/* 发布话题弹窗 */}
        {showPublishModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowPublishModal(false)} />
            <div className="relative w-full max-w-2xl mx-4">
              <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-white">发布话题</h3>
                  <button onClick={() => setShowPublishModal(false)} className="text-slate-400 hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-300">标题（必填）</label>
                    <input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="输入话题标题"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-300">内容（必填）</label>
                    <textarea
                      value={form.content}
                      onChange={(e) => setForm({ ...form, content: e.target.value })}
                      placeholder="分享你的想法、经验或见解..."
                      rows={6}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-slate-300">分类</label>
                      <select
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                      >
                        <option>#脑洞大开</option>
                        <option>#避坑指南</option>
                        <option>#求组队</option>
                        <option>#行业吐槽</option>
                        <option>#工具测评</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-slate-300">标签（可选）</label>
                      <input
                        value={form.tag}
                        onChange={(e) => setForm({ ...form, tag: e.target.value })}
                        placeholder="如：技术先锋"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-300">图片 URL（可选）</label>
                    <div className="relative mt-2">
                      <input
                        value={form.image_url}
                        onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                        placeholder="https://..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500"
                      />
                      <Image size={18} className="absolute left-3 top-3 text-slate-400" />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button onClick={() => setShowPublishModal(false)} className="px-4 py-2 rounded-full bg-slate-700 text-slate-300 hover:text-white transition-colors">取消</button>
                    <button
                      onClick={handlePublish}
                      className="px-4 py-2 rounded-full bg-cyan-600 border border-cyan-500 text-white font-medium hover:opacity-95 transition-colors"
                    >
                      发布
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 删除确认弹窗 */}
        {showDeleteModal && deleteTarget && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }} />
            <div className="relative w-full max-w-md mx-4">
              <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
                <h3 className="text-2xl font-bold text-white mb-2">确认删除话题</h3>
                <p className="text-slate-300 mb-6">确定要删除话题"{deleteTarget.title}"吗？此操作不可撤销。</p>
                <div className="flex items-center justify-end gap-3">
                  <button onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }} className="px-4 py-2 rounded-full bg-slate-700 text-slate-300 hover:text-white transition-colors">取消</button>
                  <button
                    onClick={confirmDelete}
                    className="px-4 py-2 rounded-full bg-rose-600 text-white font-medium hover:opacity-95 transition-colors"
                  >
                    确认删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
           {/* Feed */}
           <div className="lg:col-span-3 space-y-8">
              {topics.length === 0 ? (
                <div className="bg-slate-800/80 rounded-2xl p-12 border border-slate-700 text-center">
                  <p className="text-slate-400 text-lg">暂无话题，快来发布第一个话题吧！</p>
                </div>
              ) : (
                topics.map(topic => (
                  <div
                    key={topic.id}
                    onClick={() => onTopicSelect(topic.id.toString())}
                    className="relative group bg-slate-800/80 rounded-2xl p-6 border border-slate-700 hover:border-slate-500/50 transition-colors shadow-sm cursor-pointer"
                  >
                     <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-600">
                             <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${topic.user_id}`} alt="avatar" />
                           </div>
                           <div>
                              <div className="flex items-center gap-2">
                                <span className="text-white font-bold text-sm tracking-wide">用户</span>
                                {topic.tag && <span className="text-[10px] bg-cyan-950/40 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/20 font-medium">{topic.tag}</span>}
                              </div>
                              <span className="text-xs text-slate-500">{formatTime(topic.created_at)}</span>
                           </div>
                        </div>
                        <span className="text-xs text-cyan-500 bg-cyan-950/30 px-3 py-1 rounded-full border border-cyan-500/10 font-medium">{topic.category}</span>
                     </div>

                     <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-white mb-3 hover:text-cyan-400 cursor-pointer leading-snug">{topic.title}</h3>
                          <p className="text-slate-300 text-sm mb-5 leading-7 text-justify font-light">{topic.content}</p>

                          <div className="flex items-center gap-6 text-slate-500 text-sm font-medium">
                             <button className="flex items-center gap-2 hover:text-cyan-400 transition-colors">
                                <ThumbsUp size={16} /> {topic.likes_count}
                             </button>
                             <button className="flex items-center gap-2 hover:text-cyan-400 transition-colors">
                                <MessageSquare size={16} /> {topic.comments_count}
                             </button>
                             <button className="flex items-center gap-2 hover:text-cyan-400 transition-colors">
                                <Eye size={16} /> {topic.views_count}
                             </button>
                             <button
                               onClick={(e) => handleShare(e, topic.id)}
                               className="flex items-center gap-2 hover:text-cyan-400 transition-colors"
                             >
                                {copiedTopicId === topic.id ? <Check size={16} /> : <Share2 size={16} />}
                                {copiedTopicId === topic.id ? '已复制' : '分享'}
                             </button>
                          </div>
                        </div>

                        {topic.image_url && (
                          <div className="w-full md:w-48 h-32 rounded-xl overflow-hidden flex-shrink-0 border border-slate-700">
                             <img src={topic.image_url} alt="preview" className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" />
                          </div>
                        )}
                     </div>

                     {currentUserId === topic.user_id && (
                       <button
                         onClick={(e) => handleDelete(e, topic)}
                         className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg bg-rose-900/80 border border-rose-600 hover:bg-rose-700 text-rose-300"
                         title="删除话题"
                       >
                         <Trash size={14} />
                       </button>
                     )}
                  </div>
                ))
              )}
           </div>

           {/* Sidebar */}
           <div className="hidden lg:block space-y-8">
              <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700 shadow-sm">
                 <h3 className="text-white font-bold mb-5 flex items-center gap-2 text-lg">
                   <Hash size={20} className="text-orange-500" /> 热门话题
                 </h3>
                 <ul className="space-y-4">
                   {hotTopics.length === 0 ? (
                     <li className="text-slate-500 text-sm text-center py-4">暂无热门话题</li>
                   ) : (
                     hotTopics.map(topic => (
                       <li key={topic.id} className="flex justify-between items-center text-sm group cursor-pointer hover:bg-slate-700/50 p-2 -mx-2 rounded-lg transition-colors">
                        <div className="flex-1">
                           <span className="text-slate-400 group-hover:text-white transition-colors tracking-wide">{topic.display_name}</span>
                           <span className="ml-2 text-xs text-slate-600">{topic.count} 讨论</span>
                        </div>
                        <ArrowUpRight size={14} className="text-slate-600 group-hover:text-cyan-400 flex-shrink-0 ml-2" />
                     </li>
                     ))
                   )}
                 </ul>
              </div>

              <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700 shadow-sm">
                 <h3 className="text-white font-bold mb-5 text-lg">推荐关注</h3>
                 <ul className="space-y-5">
                   {recommendedUsers.length === 0 ? (
                     <li className="text-slate-500 text-sm text-center py-4">暂无推荐用户</li>
                   ) : (
                     recommendedUsers.map(user => (
                       <li key={user.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-slate-700 border border-slate-600 overflow-hidden">
                             {user.avatar_url ? (
                               <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" />
                             ) : (
                               <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.user_id}`} alt={user.display_name} className="w-full h-full object-cover" />
                             )}
                           </div>
                           <div>
                              <p className="text-sm text-white font-bold">{user.display_name}</p>
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{user.role}</p>
                              {user.followers_count > 0 && (
                                <p className="text-[10px] text-slate-600">{user.followers_count} 粉丝</p>
                              )}
                           </div>
                        </div>
                        <button className="text-xs bg-slate-700 text-cyan-400 px-3 py-1.5 rounded-full border border-slate-600 hover:bg-cyan-600 hover:text-white hover:border-cyan-500 transition-all font-medium">
                           关注
                        </button>
                     </li>
                     ))
                   )}
                 </ul>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};