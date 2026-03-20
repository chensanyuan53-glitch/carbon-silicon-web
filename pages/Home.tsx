import React, { useEffect, useState } from 'react';
import { Page } from '../types';
import { ArrowRight, Zap, Users, Shield, Cpu, Timer, Trophy, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../src/supabaseClient';

interface HomeProps {
  onNavigate: (page: Page) => void;
}

interface Task {
  id: string;
  title?: string;
  description?: string;
  reward?: number;
  category?: string;
  created_at?: string;
  [key: string]: any;
}

interface CarouselSlide {
  id: string;
  title: string;
  description: string;
  image: string;
  link?: Page;
  externalUrl?: string;
  badge?: string;
}

export const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  const [latestTask, setLatestTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const carouselSlides: CarouselSlide[] = [
    {
      id: 'slide1',
      title: 'AI 创意设计大赛',
      description: '用 AI 工具创作独特作品，赢取丰厚奖金',
      image: '/carousel1.jpg',
      link: Page.ARENA,
      badge: '热门活动'
    },
    {
      id: 'slide2',
      title: '上传你的轮播图',
      description: '等待你上传图片和内容',
      image: '/carousel2.jpg',
      externalUrl: 'https://community.cssymbiosis.com/',
      badge: '待添加'
    }
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      nextSlide();
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  useEffect(() => {
    const fetchLatestTask = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error) {
          console.error('Error fetching task:', error);
        } else {
          setLatestTask(data);
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLatestTask();
  }, []);
  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')] bg-cover bg-center">
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32 flex flex-col items-center text-center">
          {/* Carousel */}
          <div
            className="relative w-full max-w-4xl h-96 md:h-[28rem] lg:h-[32rem] rounded-2xl overflow-hidden shadow-2xl"
            onMouseEnter={() => setIsAutoPlaying(false)}
            onMouseLeave={() => setIsAutoPlaying(true)}
          >
            {/* Background Images */}
            <div className="absolute inset-0">
              {carouselSlides.map((slide, index) => (
                <div
                  key={slide.id}
                  className={`absolute inset-0 transition-opacity duration-700 ${
                    index === currentSlide ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <img
                    src={slide.image}
                    alt={slide.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent"></div>
                </div>
              ))}
            </div>

            {/* Navigation Arrows */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                prevSlide();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white flex items-center justify-center backdrop-blur-sm border border-white/10 transition-all hover:scale-110 shadow-lg z-20"
            >
              <ChevronLeft size={20} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                nextSlide();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white flex items-center justify-center backdrop-blur-sm border border-white/10 transition-all hover:scale-110 shadow-lg z-20"
            >
              <ChevronRight size={20} />
            </button>

            {/* Clickable overlay */}
            <div
              className="absolute inset-0 z-10 cursor-pointer"
              onClick={() => {
                const current = carouselSlides[currentSlide];
                if (current.externalUrl) {
                  window.open(current.externalUrl, '_blank');
                } else if (current.link) {
                  onNavigate(current.link);
                }
              }}
            />

            {/* Dots Indicator */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30">
              {carouselSlides.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToSlide(index);
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentSlide
                      ? 'bg-cyan-400 w-6'
                      : 'bg-slate-600 hover:bg-slate-500'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Ticker */}
          <div className="mt-16 bg-black/40 backdrop-blur rounded-full px-6 py-2.5 border border-white/10 flex items-center gap-4 text-sm text-slate-400 shadow-xl">
            <span className="text-orange-500 font-bold whitespace-nowrap flex items-center gap-1"><Zap size={14}/> 最新需求:</span>
            <div className="overflow-hidden h-5 w-full md:w-96 text-left">
              {loading ? (
                <p className="leading-5 text-slate-300">加载中...</p>
              ) : latestTask ? (
                <p className="animate-slide-up leading-5 text-slate-300">
                  {latestTask.category ? `[${latestTask.category}] ` : ''}
                  {latestTask.title || latestTask.description || '新任务'}
                  {latestTask.reward ? `，悬赏 ¥${latestTask.reward}` : ''}
                </p>
              ) : (
                <p className="leading-5 text-slate-300">暂无最新需求</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Feature Cards Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Tools Card */}
          <div className="bg-slate-800/90 backdrop-blur border border-slate-700 rounded-2xl p-8 hover:border-cyan-500/50 transition-colors cursor-pointer group shadow-2xl" onClick={() => onNavigate(Page.STATION)}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white tracking-wide">本周热门工具</h3>
              <ArrowRight size={18} className="text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
            </div>
            <div className="flex gap-4 justify-between">
               <div className="flex flex-col items-center gap-3">
                 <div className="w-14 h-14 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center shadow-lg text-indigo-400 group-hover:scale-110 transition-transform duration-300">
                    <span className="font-bold text-lg">Mj</span>
                 </div>
                 <span className="text-xs text-slate-400 font-medium">Midjourney</span>
               </div>
               <div className="flex flex-col items-center gap-3">
                 <div className="w-14 h-14 bg-green-600/20 border border-green-500/30 rounded-xl flex items-center justify-center shadow-lg text-green-400 group-hover:scale-110 transition-transform duration-300 delay-75">
                    <span className="font-bold text-lg">G</span>
                 </div>
                 <span className="text-xs text-slate-400 font-medium">ChatGPT</span>
               </div>
               <div className="flex flex-col items-center gap-3">
                 <div className="w-14 h-14 bg-purple-600/20 border border-purple-500/30 rounded-xl flex items-center justify-center shadow-lg text-purple-400 group-hover:scale-110 transition-transform duration-300 delay-150">
                    <span className="font-bold text-lg">Sd</span>
                 </div>
                 <span className="text-xs text-slate-400 font-medium">Stable Diffusion</span>
               </div>
            </div>
          </div>

          {/* Competition Card */}
          <div className="bg-gradient-to-br from-blue-900/90 to-slate-900/90 backdrop-blur border border-blue-500/30 rounded-2xl p-8 relative overflow-hidden cursor-pointer group shadow-2xl hover:shadow-blue-500/20 transition-all" onClick={() => onNavigate(Page.ARENA)}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Trophy className="w-32 h-32 -mr-8 -mt-8 rotate-12" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-yellow-400 font-bold text-xs tracking-wider uppercase bg-yellow-950/30 px-2 py-0.5 rounded border border-yellow-500/20">正在进行</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-6 leading-snug">未来家园<br/>共创挑战赛</h3>
              <div className="flex items-end gap-3 mb-6">
                <div className="bg-slate-900/60 rounded-lg px-3 py-2 text-center border border-white/5 backdrop-blur-sm">
                   <span className="text-xl font-mono font-bold text-white block leading-none mb-1">02</span>
                   <span className="text-[10px] text-slate-400 font-medium">天</span>
                </div>
                <div className="bg-slate-900/60 rounded-lg px-3 py-2 text-center border border-white/5 backdrop-blur-sm">
                   <span className="text-xl font-mono font-bold text-white block leading-none mb-1">14</span>
                   <span className="text-[10px] text-slate-400 font-medium">小时</span>
                </div>
                <div className="bg-slate-900/60 rounded-lg px-3 py-2 text-center border border-white/5 backdrop-blur-sm">
                   <span className="text-xl font-mono font-bold text-white block leading-none mb-1">30</span>
                   <span className="text-[10px] text-slate-400 font-medium">分</span>
                </div>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-white/10">
                <span className="text-slate-400 text-sm">总奖金池</span>
                <span className="text-2xl font-black text-yellow-400 tracking-tight">¥150,000</span>
              </div>
            </div>
          </div>

          {/* Bootcamp Card */}
          <div className="bg-slate-800/90 backdrop-blur border border-slate-700 rounded-2xl p-8 hover:border-cyan-500/50 transition-colors cursor-pointer group shadow-2xl" onClick={() => onNavigate(Page.STATION)}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white tracking-wide">训练营推荐</h3>
              <ArrowRight size={18} className="text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4 bg-slate-700/30 p-4 rounded-xl border border-slate-700/50 hover:bg-slate-700/60 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/20">
                  <Zap size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">AI 产品经理实战营</h4>
                  <p className="text-xs text-slate-400 tracking-wide">报名中: <span className="text-orange-400">50</span>/100人</p>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-slate-700/30 p-4 rounded-xl border border-slate-700/50 hover:bg-slate-700/60 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                  <Cpu size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">ComfyUI 进阶工作流</h4>
                  <p className="text-xs text-slate-400 tracking-wide">更新至第 5 课</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
