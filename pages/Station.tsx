import React, { useState, useEffect } from 'react';
import { Search, ChevronRight, ExternalLink, Zap, Layout, Sprout, Briefcase, Cpu, PenTool, Globe, Trash } from 'lucide-react';
import { supabase } from '../src/supabaseClient';
import { AiCategory, AiTool } from '../types';

type Tab = 'news' | 'cases' | 'learning';
type DomainFilter = '家装' | '农业' | '能源' | '职场';

interface StationProps {
  initialTab?: string | null;
}

export const Station: React.FC<StationProps> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState<Tab>('news');

  // 如果有初始标签，设置它
  useEffect(() => {
    if (initialTab && (initialTab === 'news' || initialTab === 'cases' || initialTab === 'learning')) {
      setActiveTab(initialTab as Tab);
    }
  }, [initialTab]);
  const [activeFilter, setActiveFilter] = useState<DomainFilter | 'all'>('家装');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [form, setForm] = useState({
    title: '',
    source: '',
    link: '',
    tag: '',
    domain: '家装',
    summary: '',
    image_url: '',
    published: true,
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // 判断是否为管理员（从profiles表查询is_admin字段）

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [caseForm, setCaseForm] = useState({
    title: '',
    category: '家装',
    image_url: '',
    description: '',
    link: '',
    published: true,
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'category' | 'tool'>('category');
  const [categoryForm, setCategoryForm] = useState({ id: '', name: '', slug: '', description: '', order: 0 });
  const [toolForm, setToolForm] = useState({ name: '', slug: '', description: '', url: '', icon_url: '', tags: '', category_id: '', is_public: true, order: 0 });
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<AiCategory | null>(null);
  const [showDeleteToolModal, setShowDeleteToolModal] = useState(false);
  const [deleteToolTarget, setDeleteToolTarget] = useState<AiTool | null>(null);

  // --- Data ---
  const [newsData, setNewsData] = useState<any[]>([]);
  const [filteredNews, setFilteredNews] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_news')
        .select('id, title, tag, link, source, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        console.error('fetch ai_news error', error);
        return;
      }
      console.log('News data fetched:', data);
      const rows = (data || []).map((r: any) => {
        const d = r.created_at ? new Date(r.created_at) : new Date();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return {
          date: `${mm}-${dd}`,
          tag: r.tag || '',
          title: r.title || '',
          link: r.link || '#',
          source: r.source || '',
          id: r.id,
        };
      });
      setNewsData(rows);
      setFilteredNews(rows);
    } catch (err) {
      console.error('unexpected fetch error', err);
    }
  };

  const [caseData, setCaseData] = useState<any[]>([]);
  const [filteredCases, setFilteredCases] = useState<any[]>([]);
  const [categories, setCategories] = useState<AiCategory[]>([]);
  const [toolsMap, setToolsMap] = useState<Record<string, AiTool[]>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id?: number; title?: string } | null>(null);

  // 初始化：获取用户信息和管理员状态
  const fetchUserAdminStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching admin status:', error);
        setIsAdmin(false);
        return;
      }
      
      setIsAdmin(data?.is_admin || false);
    } catch (err) {
      console.error('Unexpected error fetching admin status:', err);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data?.user?.id || null;
      setCurrentUserId(userId);
      
      if (userId) {
        await fetchUserAdminStatus(userId);
      }
      
      // 并行请求，提高加载速度
      await Promise.all([
        fetchNews(),
        fetchCases(),
        fetchLearning()
      ]);
    };
    init();
  }, []);

  const [toast, setToast] = useState<{ visible: boolean; message: string; type?: 'success' | 'error' | 'info' }>({ visible: false, message: '', type: 'info' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type }), duration);
  };

  // 模糊搜索逻辑
  const fuzzySearch = (text: string, query: string): boolean => {
    if (!query) return true;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    return lowerText.includes(lowerQuery);
  };

  // 处理搜索输入
  const handleSearch = (value: string) => {
    setSearchQuery(value);

    if (!value) {
      // 清空搜索时显示全部
      setFilteredNews(newsData);
      setFilteredCases(caseData);
      return;
    }

    // 搜索资讯（标题、标签、来源）
    const filteredNewsData = newsData.filter(item =>
      fuzzySearch(item.title, value) ||
      fuzzySearch(item.tag, value) ||
      fuzzySearch(item.source, value)
    );
    setFilteredNews(filteredNewsData);

    // 搜索案例（标题、描述、分类）
    const filteredCasesData = caseData.filter(item =>
      fuzzySearch(item.title, value) ||
      fuzzySearch(item.desc, value) ||
      fuzzySearch(item.category, value)
    );
    setFilteredCases(filteredCasesData);
  };

  const fetchCases = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_cases')
        .select('id, title, category, image_url, description, link, created_at, user_id')
        .eq('published', true)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        console.error('fetch ai_cases error', error);
        return;
      }
      const rows = (data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        image: r.image_url || '',
        desc: r.description || '',
        link: r.link || '',
        user_id: r.user_id,
      }));
      setCaseData(rows);
      setFilteredCases(rows);
    } catch (err) {
      console.error('unexpected fetchCases error', err);
    }
  };

  const getIconForSlug = (slug?: string) => {
    if (!slug) return <Globe size={20} className="text-slate-400" />;
    const s = slug.toLowerCase();
    if (s.includes('draw') || s.includes('image') || s.includes('diff') || s.includes('绘图') || s.includes('生成')) return <PenTool size={20} className="text-purple-400" />;
    if (s.includes('llm') || s.includes('model') || s.includes('大模型') || s.includes('chat')) return <Cpu size={20} className="text-blue-400" />;
    if (s.includes('eff') || s.includes('prod') || s.includes('效率') || s.includes('assistant')) return <Zap size={20} className="text-orange-400" />;
    return <Globe size={20} className="text-slate-400" />;
  };

  const fetchLearning = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_tool_categories')
        .select('id, name, slug, description, "order", ai_tools(id, category_id, name, slug, description, url, icon_url, tags, is_public, "order", user_id, metadata, created_at, updated_at)')
        .order('order', { ascending: true });
      if (error) {
        console.error('fetch ai_tool_categories error', error);
        return;
      }
      const cats = (data || []) as AiCategory[];
      setCategories(cats.map(c => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, order: c.order, created_at: c.created_at, updated_at: c.updated_at, ai_tools: c.ai_tools })));
      const map: Record<string, AiTool[]> = {};
      (cats || []).forEach((c: any) => {
        map[c.id] = (c.ai_tools || []).map((t: any) => ({
          id: t.id,
          category_id: t.category_id,
          name: t.name,
          slug: t.slug,
          description: t.description,
          url: t.url,
          icon_url: t.icon_url,
          tags: t.tags,
          is_public: t.is_public,
          order: t.order,
          user_id: t.user_id,
          metadata: t.metadata,
          created_at: t.created_at,
          updated_at: t.updated_at,
        }));
      });
      setToolsMap(map);
    } catch (err) {
      console.error('unexpected fetchLearning error', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 pb-20 pt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header & Title */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">碳硅情报站</h1>
            <p className="text-slate-400 text-lg">洞察前沿，落地实践。</p>
          </div>
          <div className="relative w-full md:w-80">
             <input
               type="text"
               placeholder="搜索资讯、案例..."
               value={searchQuery}
               onChange={(e) => handleSearch(e.target.value)}
               className="w-full bg-slate-800 border border-slate-700 rounded-full pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors shadow-sm placeholder:text-slate-500"
             />
             <Search size={18} className="absolute left-3.5 top-3 text-slate-400" />
          </div>
        </div>

        {/* Top Tabs */}
        <div className="border-b border-slate-700 mb-10 flex items-center justify-between">
          <div className="flex space-x-8 overflow-x-auto">
          {[
            { id: 'news', label: 'AI 前沿资讯' },
            { id: 'cases', label: '领域应用案例' },
            { id: 'learning', label: 'AI 学习导航' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`pb-4 text-base font-medium transition-all whitespace-nowrap tracking-wide ${
                activeTab === tab.id
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-white border-b-2 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
          </div>

          {isAdmin && (
            <button
              onClick={async () => {
                const { data } = await supabase.auth.getUser();
                const user = data?.user;
                if (!user) {
                  if (activeTab === 'news') showToast('请先登录后发布资讯', 'info');
                  else if (activeTab === 'cases') showToast('请先登录后上传案例', 'info');
                  else showToast('请先登录', 'info');
                  return;
                }
                if (activeTab === 'news') setShowPublishModal(true);
                else if (activeTab === 'cases') setShowUploadModal(true);
                else if (activeTab === 'learning') setShowAddModal(true);
                else setShowPublishModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-cyan-600 border border-cyan-500 text-white shadow-lg hover:opacity-95 transition-colors"
            >
              {activeTab === 'news' ? '发布资讯' : activeTab === 'cases' ? '上传案例' : activeTab === 'learning' ? '添加' : '发布资讯'}
            </button>
          )}
        </div>

        {/* Content Section A: News */}
        {activeTab === 'news' && (
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700 overflow-hidden animate-fade-in shadow-xl">
            {filteredNews.length === 0 ? (
              <div className="p-12 text-center">
                <Search size={48} className="mx-auto text-slate-600 mb-4" />
                <p className="text-slate-400 text-lg mb-2">
                  {searchQuery ? '未找到相关资讯' : '暂无资讯'}
                </p>
                {searchQuery && (
                  <p className="text-slate-500 text-sm">试试其他关键词</p>
                )}
              </div>
            ) : (
              filteredNews.map((item, index) => (
                <a key={index} href={item.link || '#'} target="_blank" rel="noreferrer" className="block">
                  <div
                    className="group flex items-center justify-between p-5 md:p-7 border-b border-slate-700/50 last:border-0 hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-6 md:gap-8 overflow-hidden">
                      <span className="text-slate-500 font-mono text-sm whitespace-nowrap">{item.date}</span>
                      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 overflow-hidden">
                        <span className="text-cyan-500 bg-cyan-950/30 px-2.5 py-0.5 rounded text-xs border border-cyan-500/20 whitespace-nowrap w-fit font-medium">
                          {item.tag}
                        </span>
                        <div className="flex flex-col overflow-hidden">
                          <h3 className="text-white font-medium text-lg truncate group-hover:text-cyan-400 transition-colors tracking-wide">
                            {item.title}
                          </h3>
                          {item.source && (
                            <span className="text-slate-500 text-sm mt-1 truncate">来源：{item.source}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-600 group-hover:text-white transition-colors flex-shrink-0 ml-4" />
                  </div>
                </a>
              ))
            )}
            {filteredNews.length > 0 && (
              <div className="p-5 text-center border-t border-slate-700/50 hover:bg-slate-800 transition-colors cursor-pointer">
                <button className="text-sm text-slate-400 group-hover:text-white transition-colors font-medium">查看更多历史资讯</button>
              </div>
            )}
          </div>
        )}

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

        {/* 发布资讯弹窗 */}
        {showPublishModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowPublishModal(false)} />
            <div className="relative w-full max-w-2xl mx-4">
              <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
                <h3 className="text-2xl font-bold text-white mb-4">发布 AI 前沿资讯</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-300">标题（必填）</label>
                    <input name="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="输入资讯标题" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-300">出处</label>
                    <input name="source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="文章来源或媒体" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-300">链接（必填，点击跳转）</label>
                    <input name="link" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-slate-300">标签（例如：#大模型）</label>
                      <input name="tag" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="#大模型" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
                    </div>
                    <div>
                      <label className="text-sm text-slate-300">分类</label>
                      <select name="domain" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                        <option>家装</option>
                        <option>农业</option>
                        <option>能源</option>
                        <option>职场</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-300">摘要 / 内容摘录（可选）</label>
                    <textarea name="summary" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="在此输入摘要或站内摘录" rows={4} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-300">缩略图 URL（可选）</label>
                    <input name="image_url" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button onClick={() => setShowPublishModal(false)} className="px-4 py-2 rounded-full bg-slate-700 text-slate-300 hover:text-white transition-colors">取消</button>
                    <button
                      onClick={async () => {
                        // 检查登录
                        const { data, error: userErr } = await supabase.auth.getUser();
                        const user = data?.user;
                        if (!user) {
                          showToast('请先登录后发布资讯', 'info');
                          return;
                        }
                        if (!form.title || !form.link) {
                          showToast('请填写标题和链接', 'error');
                          return;
                        }
                        const { error } = await supabase.from('ai_news').insert([{
                          title: form.title,
                          source: form.source,
                          tag: form.tag,
                          summary: form.summary,
                          content: form.summary,
                          link: form.link,
                          image_url: form.image_url,
                          domain: form.domain,
                          user_id: user.id,
                          published: form.published
                        }]);
                        if (error) {
                          console.error('publish error', error);
                          showToast('发布失败，请稍后重试', 'error');
                        } else {
                          await fetchNews();
                          setShowPublishModal(false);
                          setForm({ title: '', source: '', link: '', tag: '', domain: '家装', summary: '', image_url: '', published: true });
                          showToast('发布成功', 'success');
                        }
                      }}
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

        {/* 添加 类别/工具 弹窗 */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowAddModal(false)} />
            <div className="relative w-full max-w-2xl mx-4">
              <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-white">{addMode === 'category' ? '添加类别' : '添加工具'}</h3>
                  <div className="inline-flex rounded-full bg-slate-700 p-1">
                    <button onClick={() => setAddMode('category')} className={`px-3 py-1 rounded-full text-sm ${addMode === 'category' ? 'bg-cyan-600 text-white' : 'text-slate-300'}`}>类别</button>
                    <button onClick={() => setAddMode('tool')} className={`px-3 py-1 rounded-full text-sm ${addMode === 'tool' ? 'bg-cyan-600 text-white' : 'text-slate-300'}`}>工具</button>
                  </div>
                </div>

                {addMode === 'category' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-slate-300">类别名称（必填）</label>
                      <input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} placeholder="例如：绘图工具" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
                    </div>
                    <div>
                      <label className="text-sm text-slate-300">Slug（必填，英文或短句）</label>
                      <input value={categoryForm.slug} onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })} placeholder="generation" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
                    </div>
                    <div>
                      <label className="text-sm text-slate-300">描述（可选）</label>
                      <textarea value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} rows={3} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
                    </div>
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-full bg-slate-700 text-slate-300 hover:text-white transition-colors">取消</button>
                      <button onClick={async () => {
                        const { data, error: userErr } = await supabase.auth.getUser();
                        const user = data?.user;
                        if (!user) { showToast('请先登录后操作', 'info'); return; }
                        if (!categoryForm.name || !categoryForm.slug) { showToast('请填写名称和 slug', 'error'); return; }
                        try {
                          if (categoryForm.id) {
                            // update
                            const res = await supabase.from('ai_tool_categories').update({ name: categoryForm.name, slug: categoryForm.slug, description: categoryForm.description, order: categoryForm.order }).eq('id', categoryForm.id).select();
                            console.debug('update category res:', res);
                            if (res.error || !res.data || (Array.isArray(res.data) && res.data.length === 0)) {
                              console.error('update category error or empty response', res.error, res);
                              showToast('更新失败: ' + (res.error?.message || '服务器未返回数据（可能受限于权限）'), 'error');
                            } else {
                              showToast('类别已更新', 'success'); setShowAddModal(false); setCategoryForm({ id: '', name: '', slug: '', description: '', order: 0 }); await fetchLearning();
                            }
                          } else {
                            // insert - 自动计算 order 为最大值 + 1
                            const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.order || 0)) : 0;
                            const res = await supabase.from('ai_tool_categories').insert([{ name: categoryForm.name, slug: categoryForm.slug, description: categoryForm.description, order: maxOrder + 1 }]).select();
                            console.debug('insert category res:', res);
                            if (res.error || !res.data || (Array.isArray(res.data) && res.data.length === 0)) {
                              console.error('insert category error or empty response', res.error, res);
                              showToast('添加失败: ' + (res.error?.message || '服务器未返回数据（可能受限于权限）'), 'error');
                            } else {
                              showToast('类别已添加', 'success'); setShowAddModal(false); setCategoryForm({ id: '', name: '', slug: '', description: '', order: 0 }); await fetchLearning();
                            }
                          }
                        } catch (err: any) {
                          console.error('category op exception', err);
                          showToast('操作异常: ' + (err?.message || String(err)), 'error');
                        }
                      }} className="px-4 py-2 rounded-full bg-cyan-600 border border-cyan-500 text-white font-medium hover:opacity-95 transition-colors">{categoryForm.id ? '更新类别' : '添加类别'}</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-slate-300">工具名称（必填）</label>
                      <input value={toolForm.name} onChange={(e) => setToolForm({ ...toolForm, name: e.target.value })} placeholder="例如：ChatGPT" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-slate-300">Slug（必填）</label>
                        <input value={toolForm.slug} onChange={(e) => setToolForm({ ...toolForm, slug: e.target.value })} placeholder="chatgpt" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
                      </div>
                      <div>
                        <label className="text-sm text-slate-300">所属类别（必填）</label>
                        <select value={toolForm.category_id} onChange={(e) => setToolForm({ ...toolForm, category_id: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                          <option value="">请选择类别</option>
                          {categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-slate-300">链接（必填）</label>
                      <input value={toolForm.url} onChange={(e) => setToolForm({ ...toolForm, url: e.target.value })} placeholder="https://" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
                    </div>
                    <div>
                      <label className="text-sm text-slate-300">描述（可选）</label>
                      <textarea value={toolForm.description} onChange={(e) => setToolForm({ ...toolForm, description: e.target.value })} rows={3} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
                    </div>
                    <div>
                      <label className="text-sm text-slate-300">标签（逗号分隔，可选）</label>
                      <input value={toolForm.tags} onChange={(e) => setToolForm({ ...toolForm, tags: e.target.value })} placeholder="chat,llm,conversational" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
                    </div>
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-full bg-slate-700 text-slate-300 hover:text-white transition-colors">取消</button>
                      <button onClick={async () => {
                        const { data, error: userErr } = await supabase.auth.getUser();
                        const user = data?.user;
                        if (!user) { showToast('请先登录后操作', 'info'); return; }
                        if (!toolForm.name || !toolForm.slug || !toolForm.url || !toolForm.category_id) { showToast('请填写名称、slug、链接和类别', 'error'); return; }
                        const tagsArr = toolForm.tags ? toolForm.tags.split(',').map(s => s.trim()).filter(Boolean) : [];
                        const res = await supabase.from('ai_tools').insert([{
                          category_id: toolForm.category_id,
                          name: toolForm.name,
                          slug: toolForm.slug,
                          description: toolForm.description,
                          url: toolForm.url,
                          icon_url: toolForm.icon_url,
                          tags: tagsArr,
                          is_public: toolForm.is_public,
                          order: toolForm.order,
                          user_id: user.id
                        }]).select();
                        console.debug('insert tool res:', res);
                        if (res.error || !res.data || (Array.isArray(res.data) && res.data.length === 0)) {
                          console.error('insert tool error or empty response', res.error, res);
                          showToast('添加失败: ' + (res.error?.message || '服务器未返回数据（可能受限于权限）'), 'error');
                        } else {
                          showToast('工具已添加', 'success'); setShowAddModal(false); setToolForm({ name: '', slug: '', description: '', url: '', icon_url: '', tags: '', category_id: '', is_public: true, order: 0 }); await fetchLearning();
                        }
                      }} className="px-4 py-2 rounded-full bg-cyan-600 border border-cyan-500 text-white font-medium hover:opacity-95 transition-colors">添加工具</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 删除 类别 确认弹窗 */}
        {showDeleteCategoryModal && deleteCategoryTarget && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => { setShowDeleteCategoryModal(false); setDeleteCategoryTarget(null); }} />
            <div className="relative w-full max-w-md mx-4">
              <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
                <h3 className="text-2xl font-bold text-white mb-2">确认删除类别</h3>
                <p className="text-slate-300 mb-6">确定要删除“{deleteCategoryTarget.name}”吗？该操作会将其下的工具保留但类别设为 null（或根据数据库约束处理）。</p>
                <div className="flex items-center justify-end gap-3">
                  <button onClick={() => { setShowDeleteCategoryModal(false); setDeleteCategoryTarget(null); }} className="px-4 py-2 rounded-full bg-slate-700 text-slate-300 hover:text-white transition-colors">取消</button>
                  <button
                    onClick={async () => {
                      const id = deleteCategoryTarget?.id;
                      setShowDeleteCategoryModal(false);
                      setDeleteCategoryTarget(null);
                      if (!id) return;
                      try {
                        const res = await supabase.from('ai_tool_categories').delete().eq('id', id).select();
                        console.debug('delete category res:', res);
                        if (res.error || !res.data || (Array.isArray(res.data) && res.data.length === 0)) {
                          console.error('delete category error or empty response', res.error, res);
                          showToast('删除失败: ' + (res.error?.message || '服务器未返回数据（可能受限于权限）'), 'error');
                        } else {
                          await fetchLearning(); showToast('删除成功', 'success');
                        }
                      } catch (err: any) {
                        console.error('delete category exception', err);
                        showToast('删除异常: ' + (err?.message || String(err)), 'error');
                      }
                    }}
                    className="px-4 py-2 rounded-full bg-rose-600 text-white font-medium hover:opacity-95 transition-colors"
                  >
                    确认删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 删除工具确认弹窗 */}
        {showDeleteToolModal && deleteToolTarget && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => { setShowDeleteToolModal(false); setDeleteToolTarget(null); }} />
            <div className="relative w-full max-w-md mx-4">
              <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
                <h3 className="text-2xl font-bold text-white mb-2">确认删除工具</h3>
                <p className="text-slate-300 mb-6">确定要删除工具" {deleteToolTarget.name}"吗？此操作不可撤销。</p>
                <div className="flex items-center justify-end gap-3">
                  <button onClick={() => { setShowDeleteToolModal(false); setDeleteToolTarget(null); }} className="px-4 py-2 rounded-full bg-slate-700 text-slate-300 hover:text-white transition-colors">取消</button>
                  <button
                    onClick={async () => {
                      const id = deleteToolTarget?.id;
                      setShowDeleteToolModal(false);
                      setDeleteToolTarget(null);
                      if (!id) return;
                      try {
                        const res = await supabase.from('ai_tools').delete().eq('id', id).select();
                        console.debug('delete tool res:', res);
                        if (res.error || !res.data || (Array.isArray(res.data) && res.data.length === 0)) {
                          console.error('delete tool error or empty response', res.error, res);
                          showToast('删除失败: ' + (res.error?.message || '服务器未返回数据（可能受限于权限）'), 'error');
                        } else {
                          await fetchLearning();
                          showToast('删除成功', 'success');
                        }
                      } catch (err: any) {
                        console.error('delete tool exception', err);
                        showToast('删除异常: ' + (err?.message || String(err)), 'error');
                      }
                    }}
                    className="px-4 py-2 rounded-full bg-rose-600 text-white font-medium hover:opacity-95 transition-colors"
                  >
                    确认删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 上传案例弹窗 */}
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowUploadModal(false)} />
            <div className="relative w-full max-w-2xl mx-4">
              <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
                <h3 className="text-2xl font-bold text-white mb-4">上传领域应用案例</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-300">标题（必填）</label>
                    <input name="title" value={caseForm.title} onChange={(e) => setCaseForm({ ...caseForm, title: e.target.value })} placeholder="输入案例标题" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-slate-300">分类</label>
                      <select name="category" value={caseForm.category} onChange={(e) => setCaseForm({ ...caseForm, category: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                        <option>家装</option>
                        <option>农业</option>
                        <option>能源</option>
                        <option>职场</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-slate-300">缩略图 URL（可选）</label>
                      <input name="image_url" value={caseForm.image_url} onChange={(e) => setCaseForm({ ...caseForm, image_url: e.target.value })} placeholder="https://..." className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-300">案例描述（必填）</label>
                    <textarea name="description" value={caseForm.description} onChange={(e) => setCaseForm({ ...caseForm, description: e.target.value })} placeholder="请输入案例简介或关键点" rows={4} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-300">链接（可选）</label>
                    <input name="link" value={caseForm.link} onChange={(e) => setCaseForm({ ...caseForm, link: e.target.value })} placeholder="https://" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button onClick={() => setShowUploadModal(false)} className="px-4 py-2 rounded-full bg-slate-700 text-slate-300 hover:text-white transition-colors">取消</button>
                    <button
                      onClick={async () => {
                        const { data, error: userErr } = await supabase.auth.getUser();
                        const user = data?.user;
                        if (!user) {
                          showToast('请先登录后上传案例', 'info');
                          return;
                        }
                        if (!caseForm.title || !caseForm.description) {
                          showToast('请填写标题和描述', 'error');
                          return;
                        }
                        const { error } = await supabase.from('ai_cases').insert([{
                          title: caseForm.title,
                          category: caseForm.category,
                          image_url: caseForm.image_url,
                          description: caseForm.description,
                          link: caseForm.link,
                          user_id: user.id,
                          published: caseForm.published
                        }]);
                        if (error) {
                          console.error('upload case error', error);
                          showToast('上传失败，请稍后重试', 'error');
                        } else {
                          await fetchCases();
                          setShowUploadModal(false);
                          setCaseForm({ title: '', category: '家装', image_url: '', description: '', link: '', published: true });
                          showToast('上传成功', 'success');
                        }
                      }}
                      className="px-4 py-2 rounded-full bg-cyan-600 border border-cyan-500 text-white font-medium hover:opacity-95 transition-colors"
                    >
                      上传
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 删除确认弹窗（居中、无端口号信息） */}
        {showDeleteModal && deleteTarget && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }} />
            <div className="relative w-full max-w-md mx-4">
              <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
                <h3 className="text-2xl font-bold text-white mb-2">确认删除案例</h3>
                <p className="text-slate-300 mb-6">确定要删除“{deleteTarget.title}”吗？此操作不可撤销。</p>
                <div className="flex items-center justify-end gap-3">
                  <button onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }} className="px-4 py-2 rounded-full bg-slate-700 text-slate-300 hover:text-white transition-colors">取消</button>
                  <button
                    onClick={async () => {
                      const id = deleteTarget?.id;
                      setShowDeleteModal(false);
                      setDeleteTarget(null);
                      if (!id) return;
                      const { error } = await supabase.from('ai_cases').delete().eq('id', id);
                      if (error) {
                        console.error('delete case error', error);
                        showToast('删除失败，请稍后重试', 'error');
                      } else {
                        await fetchCases();
                        showToast('删除成功', 'success');
                      }
                    }}
                    className="px-4 py-2 rounded-full bg-rose-600 text-white font-medium hover:opacity-95 transition-colors"
                  >
                    确认删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content Section B: Domain Cases */}
        {activeTab === 'cases' && (
          <div className="animate-fade-in">
            {/* Filter Pills */}
            <div className="flex flex-wrap gap-3 mb-8 justify-center md:justify-start">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all border ${
                  activeFilter === 'all'
                    ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                }`}
              >
                全部
              </button>
              {[
                { id: '家装', icon: Layout },
                { id: '农业', icon: Sprout },
                { id: '能源', icon: Zap },
                { id: '职场', icon: Briefcase }
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id as DomainFilter)}
                  className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all border ${
                    activeFilter === filter.id
                      ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  <filter.icon size={16} />
                  {filter.id}
                </button>
              ))}
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredCases
                .filter(item => activeFilter === 'all' || item.category === activeFilter)
                .map(item => {
                  return (
                    <a
                      key={item.id}
                      href={item.link || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="group bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 hover:border-cyan-500/50 transition-all hover:shadow-xl hover:shadow-cyan-500/10 cursor-pointer flex flex-col h-full"
                    >
                      <div className="h-52 overflow-hidden relative">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            onError={(e) => {
                              console.log('Image load error:', item.image);
                              // 尝试使用代理
                              const fallbackUrl = `https://corsproxy.io/?${encodeURIComponent(item.image)}`;
                              if (e.currentTarget.src !== fallbackUrl) {
                                e.currentTarget.src = fallbackUrl;
                              } else {
                                e.currentTarget.style.display = 'none';
                              }
                            }}
                            crossOrigin="anonymous"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                            <span className="text-slate-500 text-sm">暂无图片</span>
                          </div>
                        )}
                        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-white border border-white/10 tracking-wide">
                          {item.category}
                        </div>
                      </div>
                      <div className="p-6 flex flex-col flex-1">
                        <h3 className="text-xl font-bold text-white mb-3 group-hover:text-cyan-400 transition-colors tracking-wide">{item.title}</h3>
                        <p className="text-slate-400 text-sm line-clamp-3 leading-relaxed flex-1">{item.desc}</p>
                        <div className="mt-6 flex items-center gap-2 text-sm text-cyan-500 font-medium opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                          <div className="flex items-center gap-1">
                            查看详情 <ChevronRight size={14} />
                          </div>
                          {currentUserId && item.user_id === currentUserId && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDeleteTarget({ id: item.id, title: item.title });
                                setShowDeleteModal(true);
                              }}
                              className="ml-auto inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-800 border border-rose-600 text-rose-300 hover:bg-rose-700 transition-colors"
                            >
                              <Trash size={14} /> 删除
                            </button>
                          )}
                        </div>
                      </div>
                    </a>
                  );
                })}
            </div>
            {filteredCases.filter(item => activeFilter === 'all' || item.category === activeFilter).length === 0 && (
               <div className="text-center py-20 text-slate-500 text-lg">
                 {searchQuery ? '未找到相关案例' : '该分类下暂无案例'}
                 {searchQuery && <p className="text-sm mt-2 text-slate-600">试试其他关键词</p>}
               </div>
            )}
          </div>
        )}

        {/* Content Section C: Learning Navigation */}
        {activeTab === 'learning' && (
          <div className="space-y-12 animate-fade-in">
            {/* Promo Banner (moved above tools) */}
            <div className="mt-4 bg-gradient-to-r from-indigo-900/40 to-purple-900/40 rounded-3xl p-10 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-8 backdrop-blur-sm">
               <div className="max-w-xl">
                  <h3 className="text-3xl font-bold text-white tracking-tight">想系统学习 AI 技术？</h3>
               </div>
               <a href="https://waytoagi.feishu.cn/wiki/QPe5w5g7UisbEkkow8XcDmOpn8e?from=from_copylink" target="_blank" rel="noreferrer" className="bg-white hover:bg-slate-100 text-indigo-950 font-bold py-4 px-8 rounded-xl transition-colors whitespace-nowrap shadow-lg text-lg">
                  浏览课程库
               </a>
            </div>

            {categories.map((section, idx) => {
              const items = toolsMap[section.id] || section.ai_tools || [];
              return (
                <div key={section.id || idx}>
                  <div className="flex items-center justify-between gap-4 mb-6 border-b border-slate-700/50 pb-4">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 shadow-md">
                        {getIconForSlug(section.slug)}
                      </div>
                      <h3 className="text-2xl font-bold text-white tracking-wide">{section.name}</h3>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setCategoryForm({ id: section.id || '', name: section.name, slug: section.slug || '', description: section.description || '', order: section.order || 0 });
                            setAddMode('category');
                            setShowAddModal(true);
                          }}
                          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-cyan-600 border border-cyan-500 text-white shadow hover:opacity-95 transition-colors"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => {
                            setDeleteCategoryTarget(section);
                            setShowDeleteCategoryModal(true);
                          }}
                          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-rose-700 border border-rose-600 text-white shadow hover:opacity-95 transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {items.map((tool: any, tIdx: number) => (
                      <div
                        key={tool.id || tIdx}
                        className="relative bg-slate-800 p-5 rounded-2xl border border-slate-700 hover:border-cyan-500 hover:bg-slate-800/80 transition-all group shadow-sm hover:shadow-cyan-500/20 flex flex-col h-full"
                      >
                        <a
                          href={tool.url || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="block flex-1 flex flex-col"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <span className="font-bold text-lg text-slate-200 group-hover:text-cyan-400 transition-colors tracking-wide">{tool.name}</span>
                            <ExternalLink size={16} className="text-slate-600 group-hover:text-cyan-500 transition-colors" />
                          </div>
                          <p className="text-sm text-slate-500 leading-relaxed group-hover:text-slate-400 transition-colors flex-1 line-clamp-3">{tool.description || ''}</p>
                        </a>
                        {currentUserId && tool.user_id === currentUserId && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteToolTarget(tool);
                              setShowDeleteToolModal(true);
                            }}
                            className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-rose-900/80 border border-rose-600 hover:bg-rose-700 text-rose-300"
                            title="删除工具"
                          >
                            <Trash size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            
            
          </div>
        )}
      </div>
    </div>
  );
};