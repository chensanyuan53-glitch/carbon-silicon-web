import React, { useState, useEffect } from 'react';
import { ShoppingBag, Star, ShieldCheck, Zap, Plus, X, Upload, Send, User, Mail, Phone } from 'lucide-react';
import { supabase } from '../src/supabaseClient';
import { MarketProduct, MarketCategory } from '../types';

interface MarketProps {
  onProductSelect?: (productId: string) => void;
}

export const Market: React.FC<MarketProps> = ({ onProductSelect }) => {
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [categories, setCategories] = useState<MarketCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MarketProduct | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type?: 'success' | 'error' | 'info' }>({ visible: false, message: '', type: 'info' });

  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    category: 'assistant',
    icon_type: 'shield',
    icon_color: 'blue',
    price: '',
    price_unit: 'month',
    contact_info: '',
    demo_url: '',
    github_url: '',
    documentation_url: '',
    tags: ''
  });

  const [inquiryForm, setInquiryForm] = useState({
    contact_method: '',
    message: ''
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type }), duration);
  };

  // 获取用户管理员状态
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

  const getIconByType = (type: string, color: string) => {
    const colorClass = `text-${color}-400`;
    switch (type) {
      case 'shield': return <ShieldCheck size={28} className={colorClass} />;
      case 'zap': return <Zap size={28} className={colorClass} />;
      case 'star': return <Star size={28} className={colorClass} />;
      default: return <ShoppingBag size={28} className={colorClass} />;
    }
  };

  const getIconColorClass = (color: string) => {
    return `bg-${color}-500/20 text-${color}-400`;
  };

  const fetchProducts = async () => {
    try {
      let query = supabase
        .from('market_products')
        .select('*')
        .eq('is_published', true)
        .order('is_official', { ascending: false })
        .order('order_index', { ascending: true });

      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }

      const { data, error } = await query;
      if (error) {
        console.error('fetch products error', error);
        return;
      }
      setProducts((data || []) as MarketProduct[]);
    } catch (err) {
      console.error('unexpected fetchProducts error', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('market_product_categories')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });
      if (error) {
        console.error('fetch categories error', error);
        return;
      }
      setCategories((data || []) as MarketCategory[]);
    } catch (err) {
      console.error('unexpected fetchCategories error', err);
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

      await fetchCategories();
      await fetchProducts();
    };
    init();
  }, [selectedCategory]);

  const handleUpload = async () => {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) {
      showToast('请先登录后上传应用', 'info');
      return;
    }
    if (!uploadForm.title || !uploadForm.description || !uploadForm.price) {
      showToast('请填写标题、描述和价格', 'error');
      return;
    }
    const tagsArr = uploadForm.tags ? uploadForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const { error } = await supabase.from('market_products').insert([{
      user_id: user.id,
      title: uploadForm.title,
      description: uploadForm.description,
      category: uploadForm.category,
      icon_type: uploadForm.icon_type,
      icon_color: uploadForm.icon_color,
      price: parseFloat(uploadForm.price),
      price_unit: uploadForm.price_unit,
      contact_info: uploadForm.contact_info || null,
      demo_url: uploadForm.demo_url || null,
      github_url: uploadForm.github_url || null,
      documentation_url: uploadForm.documentation_url || null,
      tags: tagsArr,
      is_published: true,
      rating: 5.0,
      user_count: 0,
      is_official: false
    }]);
    if (error) {
      console.error('upload product error', error);
      showToast('上传失败，请稍后重试', 'error');
    } else {
      await fetchProducts();
      setShowUploadModal(false);
      setUploadForm({
        title: '', description: '', category: 'assistant', icon_type: 'shield',
        icon_color: 'blue', price: '', price_unit: 'month', contact_info: '',
        demo_url: '', github_url: '', documentation_url: '', tags: ''
      });
      showToast('上传成功', 'success');
    }
  };

  const handleContact = (product: MarketProduct) => {
    setSelectedProduct(product);
    setInquiryForm({ contact_method: '', message: '' });
    setShowInquiryModal(true);
  };

  const handleSubmitInquiry = async () => {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) {
      showToast('请先登录后联系购买', 'info');
      return;
    }
    if (!selectedProduct) return;
    if (!inquiryForm.contact_method) {
      showToast('请填写联系方式', 'error');
      return;
    }
    const { error } = await supabase.from('market_product_inquiries').insert([{
      product_id: selectedProduct.id,
      user_id: user.id,
      contact_method: inquiryForm.contact_method,
      message: inquiryForm.message || null
    }]);
    if (error) {
      console.error('submit inquiry error', error);
      showToast('提交失败，请稍后重试', 'error');
    } else {
      setShowInquiryModal(false);
      setSelectedProduct(null);
      showToast('已发送购买咨询，卖家会尽快联系您', 'success');
    }
  };

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const stars = [];
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Star key={i} size={14} fill="currentColor" className="text-yellow-400" />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<Star key={i} size={14} fill="currentColor" className="text-yellow-400" />);
      } else {
        stars.push(<Star key={i} size={14} className="text-slate-600" />);
      }
    }
    return stars;
  };

  return (
    <div className="min-h-screen bg-slate-900 pb-20 pt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
           <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">成果应用市集</h1>
           <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">展示并销售开发好的 Agent、工作流、SOP 解决方案，<br/>供企业直接采购，快速赋能业务。</p>
        </div>

        {/* Search Bar & Upload Button */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-16 max-w-5xl mx-auto">
           <div className="relative w-full md:flex-1">
             <input
               type="text"
               placeholder="搜索工作流、AI Agent、SOP..."
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full bg-slate-800 border border-slate-700 rounded-full py-4 px-8 text-white text-lg focus:outline-none focus:border-cyan-500 shadow-2xl transition-all"
             />
             <button className="absolute right-2.5 top-2.5 bg-cyan-600 hover:bg-cyan-500 text-white p-2.5 rounded-full transition-colors shadow-lg">
                <ShoppingBag size={22} />
             </button>
           </div>
           {isAdmin && (
             <button
               onClick={() => {
                 if (!currentUserId) {
                   showToast('请先登录后上传应用', 'info');
                   return;
                 }
                 setShowUploadModal(true);
               }}
               className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-4 rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
             >
                <Plus size={18} />
                <span>上传应用</span>
             </button>
           )}
        </div>

        {/* Categories */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
           {categories.map(cat => (
             <button
               key={cat.id}
               onClick={() => setSelectedCategory(cat.name)}
               className={`px-6 py-2 rounded-full text-sm font-bold transition-all border ${
                 selectedCategory === cat.name
                   ? 'bg-cyan-600 text-white border-cyan-500 shadow-lg shadow-cyan-500/20'
                   : 'text-slate-400 hover:text-white hover:bg-slate-800 border-transparent hover:border-slate-700'
               }`}
             >
                {cat.display_name}
             </button>
           ))}
        </div>

        {/* Featured Product Banner */}
        <div
          className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/20 rounded-3xl p-10 mb-16 flex flex-col md:flex-row items-center gap-10 shadow-2xl cursor-pointer hover:shadow-purple-500/10 transition-all"
          onClick={() => {
            const featuredProduct = products.find(p => p.title === 'AI智能设计平台');
            if (featuredProduct && onProductSelect) {
              onProductSelect(String(featuredProduct.id));
            }
          }}
        >
           <div className="flex-1">
              <span className="bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-md mb-4 inline-block tracking-wide shadow-lg shadow-purple-500/30">热门推荐</span>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
                AI智能设计平台
              </h2>
              <p className="text-slate-300 mb-8 leading-relaxed text-lg max-w-lg">
                基于深度学习的智能设计工具，支持自动生成设计方案、智能配图、风格迁移等功能。让设计变得简单高效，一键生成专业级设计作品。
              </p>
              <button className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-purple-500/30 text-lg">
                查看解决方案
              </button>
           </div>
           <div className="flex-1 w-full max-w-md bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700/80">
              <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-3">
                 <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white shadow-lg">
                    <Zap size={20} />
                 </div>
                 <div>
                    <p className="text-white text-sm font-bold">AI智能设计</p>
                    <p className="text-xs text-green-400 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>在线</p>
                 </div>
              </div>
              <div className="space-y-4">
                 <div className="bg-slate-700/50 p-3 rounded-2xl rounded-tl-none text-sm text-slate-200 w-4/5 leading-relaxed">
                    帮我设计一套现代简约风格的客厅，色调以灰白为主，加入一点蓝色作为点缀。
                 </div>
                 <div className="bg-purple-600 p-3 rounded-2xl rounded-tr-none text-sm text-white w-4/5 ml-auto shadow-md leading-relaxed">
                    已为您生成3套设计方案！方案一采用极简主义风格，灰色墙面搭配蓝色地毯...
                 </div>
              </div>
           </div>
        </div>

        {/* Product Grid */}
        {products.length === 0 ? (
          <div className="bg-slate-800/80 rounded-2xl p-12 border border-slate-700 text-center mb-16">
             <p className="text-slate-400 text-lg">暂无商品，快来上传第一个商品吧！</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
             {products.map(product => (
               <div
                 key={product.id}
                 onClick={() => onProductSelect && onProductSelect(String(product.id))}
                 className="bg-slate-800 rounded-2xl border border-slate-700 p-6 hover:border-cyan-500/50 transition-all group hover:shadow-xl hover:shadow-cyan-500/5 flex flex-col h-full cursor-pointer"
               >
                  <div className="flex justify-between items-start mb-5">
                     <div className={`${getIconColorClass(product.icon_color)} p-3.5 rounded-xl`}>
                        {getIconByType(product.icon_type, product.icon_color)}
                     </div>
                     {product.is_official && (
                       <span className="bg-yellow-600/20 text-yellow-500 text-[10px] px-2 py-1 rounded border border-yellow-600/30 font-bold uppercase tracking-wider">官方严选</span>
                     )}
                  </div>
                  <h3 className="text-white font-bold text-xl mb-3 group-hover:text-cyan-400 transition-colors">{product.title}</h3>
                  <p className="text-slate-400 text-sm mb-6 leading-relaxed flex-1">{product.description}</p>

                  <div className="flex items-center gap-1 text-yellow-400 text-xs mb-6 font-medium">
                     <div className="flex">
                        {renderStars(product.rating)}
                     </div>
                     <span className="text-slate-500 ml-2">{product.user_count} 人使用</span>
                  </div>

                  <div className="flex justify-between items-center pt-5 border-t border-slate-700 mt-auto">
                     <span className="text-white font-bold text-lg">¥{product.price}<span className="text-xs text-slate-500 font-normal">/{product.price_unit === 'month' ? '月' : product.price_unit === 'year' ? '年' : '次'}</span></span>
                     <button
                       onClick={(e) => {
                         e.stopPropagation();
                         handleContact(product);
                       }}
                       className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                         product.is_official
                           ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                           : 'bg-slate-700 hover:bg-cyan-600 text-white'
                       }`}
                     >
                        {product.contact_info ? '联系购买' : '立即试用'}
                     </button>
                  </div>
               </div>
             ))}
          </div>
        )}
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

      {/* 上传应用弹窗 */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowUploadModal(false)} />
          <div className="relative w-full max-w-2xl mx-4">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-white">上传应用</h3>
                <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-300">商品标题（必填）</label>
                  <input
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                    placeholder="输入商品标题"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-300">商品描述（必填）</label>
                  <textarea
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                    placeholder="详细描述商品的功能、特点和使用场景..."
                    rows={4}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-300">分类</label>
                    <select
                      value={uploadForm.category}
                      onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="assistant">客服助手</option>
                      <option value="design">设计工具</option>
                      <option value="marketing">营销助手</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-300">价格（必填）</label>
                    <div className="flex gap-2 mt-2">
                      <input
                        type="number"
                        value={uploadForm.price}
                        onChange={(e) => setUploadForm({ ...uploadForm, price: e.target.value })}
                        placeholder="99"
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500"
                      />
                      <select
                        value={uploadForm.price_unit}
                        onChange={(e) => setUploadForm({ ...uploadForm, price_unit: e.target.value })}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500"
                      >
                        <option value="month">/月</option>
                        <option value="year">/年</option>
                        <option value="once">一次性</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-300">图标类型</label>
                    <select
                      value={uploadForm.icon_type}
                      onChange={(e) => setUploadForm({ ...uploadForm, icon_type: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="shield">盾牌</option>
                      <option value="zap">闪电</option>
                      <option value="star">星星</option>
                      <option value="shoppingBag">购物袋</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-300">图标颜色</label>
                    <select
                      value={uploadForm.icon_color}
                      onChange={(e) => setUploadForm({ ...uploadForm, icon_color: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="blue">蓝色</option>
                      <option value="purple">紫色</option>
                      <option value="green">绿色</option>
                      <option value="orange">橙色</option>
                      <option value="red">红色</option>
                      <option value="yellow">黄色</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-300">联系方式</label>
                  <input
                    value={uploadForm.contact_info}
                    onChange={(e) => setUploadForm({ ...uploadForm, contact_info: e.target.value })}
                    placeholder="微信、邮箱或其他联系方式"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-slate-300">演示链接（可选）</label>
                    <input
                      value={uploadForm.demo_url}
                      onChange={(e) => setUploadForm({ ...uploadForm, demo_url: e.target.value })}
                      placeholder="https://..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-300">GitHub（可选）</label>
                    <input
                      value={uploadForm.github_url}
                      onChange={(e) => setUploadForm({ ...uploadForm, github_url: e.target.value })}
                      placeholder="https://github.com/..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-300">文档链接（可选）</label>
                    <input
                      value={uploadForm.documentation_url}
                      onChange={(e) => setUploadForm({ ...uploadForm, documentation_url: e.target.value })}
                      placeholder="https://..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-300">标签（可选，逗号分隔）</label>
                  <input
                    value={uploadForm.tags}
                    onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                    placeholder="AI, 客服, 自动化"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button onClick={() => setShowUploadModal(false)} className="px-4 py-2 rounded-full bg-slate-700 text-slate-300 hover:text-white transition-colors">取消</button>
                  <button
                    onClick={handleUpload}
                    className="px-4 py-2 rounded-full bg-cyan-600 border border-cyan-500 text-white font-medium hover:opacity-95 transition-colors flex items-center gap-2"
                  >
                    <Upload size={16} />
                    立即上传
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 咨询购买弹窗 */}
      {showInquiryModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setShowInquiryModal(false); setSelectedProduct(null); }} />
          <div className="relative w-full max-w-md mx-4">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-white">联系购买</h3>
                <button onClick={() => { setShowInquiryModal(false); setSelectedProduct(null); }} className="text-slate-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="mb-6">
                <h4 className="text-lg font-bold text-white mb-2">{selectedProduct.title}</h4>
                <p className="text-slate-400 text-sm mb-4">{selectedProduct.description}</p>
                {selectedProduct.contact_info && (
                  <div className="bg-slate-700/50 p-3 rounded-lg mb-4">
                    <p className="text-sm text-slate-300">卖家联系方式：</p>
                    <p className="text-sm text-cyan-400 font-medium mt-1">{selectedProduct.contact_info}</p>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-300">您的联系方式（必填）</label>
                  <input
                    value={inquiryForm.contact_method}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, contact_method: e.target.value })}
                    placeholder="微信、邮箱或手机号"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-300">留言（可选）</label>
                  <textarea
                    value={inquiryForm.message}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                    placeholder="想咨询的问题..."
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button onClick={() => { setShowInquiryModal(false); setSelectedProduct(null); }} className="px-4 py-2 rounded-full bg-slate-700 text-slate-300 hover:text-white transition-colors">取消</button>
                  <button
                    onClick={handleSubmitInquiry}
                    className="px-4 py-2 rounded-full bg-cyan-600 border border-cyan-500 text-white font-medium hover:opacity-95 transition-colors flex items-center gap-2"
                  >
                    <Send size={16} />
                    发送咨询
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};