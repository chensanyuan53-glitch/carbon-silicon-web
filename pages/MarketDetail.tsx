import React, { useState, useEffect } from 'react';
import { ArrowLeft, Star, Users, ExternalLink, Github, BookOpen, Play, ShieldCheck, Zap, ShoppingBag } from 'lucide-react';
import { supabase } from '../src/supabaseClient';
import { MarketProduct } from '../types';

interface MarketDetailProps {
  productId: string;
  onBack: () => void;
}

export const MarketDetail: React.FC<MarketDetailProps> = ({ productId, onBack }) => {
  const [product, setProduct] = useState<MarketProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({
    contact_method: '',
    message: ''
  });
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type?: 'success' | 'error' | 'info' }>({ visible: false, message: '', type: 'info' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type }), duration);
  };

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const { data, error } = await supabase
          .from('market_products')
          .select('*')
          .eq('id', productId)
          .single();
        
        if (error) {
          console.error('fetch product error', error);
          return;
        }
        setProduct(data as MarketProduct);

        // 记录浏览量
        await supabase.from('market_product_views').insert([{
          product_id: parseInt(productId),
          view_count: 1
        }]);

      } catch (err) {
        console.error('unexpected fetchProduct error', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  const getIconByType = (type: string, color: string) => {
    const colorClass = `text-${color}-400`;
    switch (type) {
      case 'shield': return <ShieldCheck size={48} className={colorClass} />;
      case 'zap': return <Zap size={48} className={colorClass} />;
      case 'star': return <Star size={48} className={colorClass} />;
      default: return <ShoppingBag size={48} className={colorClass} />;
    }
  };

  const getIconColorClass = (color: string) => {
    return `bg-${color}-500/20 text-${color}-400`;
  };

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const stars = [];
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Star key={i} size={18} fill="currentColor" className="text-yellow-400" />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<Star key={i} size={18} fill="currentColor" className="text-yellow-400" />);
      } else {
        stars.push(<Star key={i} size={18} className="text-slate-600" />);
      }
    }
    return stars;
  };

  const handleContact = () => {
    setShowContactModal(true);
  };

  const handleSubmitContact = async () => {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) {
      showToast('请先登录后联系购买', 'info');
      return;
    }
    if (!contactForm.contact_method) {
      showToast('请填写联系方式', 'error');
      return;
    }

    setSending(true);

    try {
      const { error } = await supabase.from('market_product_inquiries').insert([{
        product_id: parseInt(productId),
        user_id: user.id,
        contact_method: contactForm.contact_method,
        message: contactForm.message || null
      }]);

      if (error) {
        console.error('submit inquiry error', error);
        showToast('提交失败，请稍后重试', 'error');
        return;
      }

      showToast('已发送购买咨询，卖家会尽快联系您', 'success');
      setShowContactModal(false);
      setContactForm({ contact_method: '', message: '' });
    } catch (err) {
      console.error('提交咨询异常:', err);
      showToast('提交失败，请稍后重试', 'error');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">加载中...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-lg mb-4">商品不存在</p>
          <button
            onClick={onBack}
            className="text-cyan-400 hover:text-cyan-300"
          >
            返回市场
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 pb-20 pt-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 返回按钮 */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span>返回成果市集</span>
        </button>

        {/* 商品头部信息 */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-8">
            {/* 图标 */}
            <div className={`${getIconColorClass(product.icon_color)} w-24 h-24 rounded-2xl flex items-center justify-center flex-shrink-0`}>
              {getIconByType(product.icon_type, product.icon_color)}
            </div>

            {/* 基本信息 */}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{product.title}</h1>
                {product.is_official && (
                  <span className="bg-yellow-600/20 text-yellow-500 text-xs px-3 py-1 rounded border border-yellow-600/30 font-bold uppercase tracking-wider flex-shrink-0 ml-4">
                    官方严选
                  </span>
                )}
              </div>

              <p className="text-slate-400 text-lg leading-relaxed mb-6">{product.description}</p>

              {/* 标签 */}
              {product.tags && product.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {product.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="bg-slate-700/50 text-slate-300 text-xs px-3 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 评分和使用人数 */}
              <div className="flex items-center gap-6 mb-6">
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {renderStars(product.rating)}
                  </div>
                  <span className="text-white font-semibold ml-2">{product.rating}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Users size={18} />
                  <span>{product.user_count} 人使用</span>
                </div>
              </div>

              {/* 价格和联系 */}
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">¥{product.price}</span>
                  <span className="text-slate-400 text-lg">
                    /{product.price_unit === 'month' ? '月' : product.price_unit === 'year' ? '年' : '次'}
                  </span>
                </div>
                <button
                  onClick={handleContact}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2"
                >
                  {product.contact_info ? '联系购买' : '立即试用'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 详细描述 */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">详细介绍</h2>
          <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">
            {product.description}
          </div>
        </div>

        {/* 链接资源 */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8">
          <h2 className="text-2xl font-bold text-white mb-6">相关资源</h2>

          <div className="space-y-4">
            {product.demo_url && (
              <a
                href={product.demo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between bg-slate-700/50 hover:bg-slate-700 rounded-xl p-4 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Play size={20} className="text-green-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">在线演示</p>
                    <p className="text-slate-400 text-sm">点击查看实际效果演示</p>
                  </div>
                </div>
                <ExternalLink size={20} className="text-slate-400 group-hover:text-white transition-colors" />
              </a>
            )}

            {product.documentation_url && (
              <a
                href={product.documentation_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between bg-slate-700/50 hover:bg-slate-700 rounded-xl p-4 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <BookOpen size={20} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">使用文档</p>
                    <p className="text-slate-400 text-sm">查看详细的使用说明和API文档</p>
                  </div>
                </div>
                <ExternalLink size={20} className="text-slate-400 group-hover:text-white transition-colors" />
              </a>
            )}

            {product.github_url && (
              <a
                href={product.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between bg-slate-700/50 hover:bg-slate-700 rounded-xl p-4 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Github size={20} className="text-purple-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">GitHub 仓库</p>
                    <p className="text-slate-400 text-sm">查看源代码和贡献指南</p>
                  </div>
                </div>
                <ExternalLink size={20} className="text-slate-400 group-hover:text-white transition-colors" />
              </a>
            )}

            {!product.demo_url && !product.documentation_url && !product.github_url && (
              <p className="text-slate-400 text-center py-8">暂无相关资源链接</p>
            )}
          </div>
        </div>
      </div>

      {/* 联系购买弹窗 */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowContactModal(false)} />
          <div className="relative w-full max-w-md mx-4">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
              <h3 className="text-2xl font-bold text-white mb-4">联系购买</h3>
              {product.contact_info && (
                <div className="bg-slate-700/50 p-3 rounded-lg mb-4">
                  <p className="text-sm text-slate-300">卖家联系方式：</p>
                  <p className="text-sm text-cyan-400 font-medium mt-1">{product.contact_info}</p>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-300">您的联系方式（必填）</label>
                  <input
                    value={contactForm.contact_method}
                    onChange={(e) => setContactForm({ ...contactForm, contact_method: e.target.value })}
                    placeholder="微信、邮箱或手机号"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-300">留言（可选）</label>
                  <textarea
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    placeholder="想咨询的问题..."
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 mt-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowContactModal(false)}
                    disabled={sending}
                    className="px-4 py-2 rounded-full bg-slate-700 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSubmitContact}
                    disabled={sending}
                    className="px-4 py-2 rounded-full bg-cyan-600 border border-cyan-500 text-white font-medium hover:opacity-95 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {sending ? '发送中...' : '发送咨询'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast 提示 */}
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
