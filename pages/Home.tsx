import React, { useEffect, useState } from 'react';
import { Page } from '../types';
import { ArrowRight, Zap, Users, Shield, Cpu, Timer, Trophy } from 'lucide-react';
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

export const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  const [latestTask, setLatestTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

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
          <div className="flex items-center gap-2 text-cyan-400 mb-8 bg-cyan-950/30 px-5 py-2 rounded-full border border-cyan-500/30 shadow-lg shadow-cyan-500/10 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-sm font-medium tracking-wide">重塑行业新生态</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8 leading-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
              碳基智慧引领，
            </span>
            <br className="hidden md:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 mt-2 inline-block">
              硅基能力落地
            </span>
          </h1>
          
          <p className="max-w-2xl text-lg md:text-xl text-slate-300 mb-12 leading-relaxed tracking-wide font-light">
            连接 AI 探索者与行业专家，共创 AI 原生应用。<br className="hidden md:block" />打破技术壁垒，让创意真正落地为生产力。
          </p>
          
          <div className="flex flex-col sm:flex-row gap-5 w-full max-w-lg">
            <button 
              onClick={() => onNavigate(Page.TASKS)}
              className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white px-8 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 group shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-0.5"
            >
              <Users size={22} />
              <div className="text-left">
                <span className="block leading-none">我是行业专家</span>
                <span className="text-[10px] font-normal opacity-80 block mt-1 tracking-wide">我有场景/痛点</span>
              </div>
            </button>
            <button 
              onClick={() => onNavigate(Page.TASKS)}
              className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white px-8 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-slate-700/50 hover:-translate-y-0.5"
            >
              <Cpu size={22} />
              <div className="text-left">
                <span className="block leading-none">我是 AI 探索者</span>
                <span className="text-[10px] font-normal opacity-80 block mt-1 tracking-wide">我想实战/赚钱</span>
              </div>
            </button>
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
