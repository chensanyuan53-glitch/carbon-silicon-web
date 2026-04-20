import React, { useState, useEffect, useMemo } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Trophy, Clock, Plus, X, Lightbulb, BarChart3, Zap, Users, Sparkles, Trash2, AlertTriangle } from 'lucide-react';
import { fetchArenas, createArena, deleteArena } from '../src/api/arena';
import { Page } from '../types';
import type { Arena as ArenaType } from '../types/supabase';

type ArenaWithCount = ArenaType & { submission_count: number };
import type { CreateArenaInput } from '../src/api/arena';
import { ArenaDetail } from './ArenaDetail';
import { supabase } from '../src/supabaseClient';

interface ArenaProps {
  session?: Session | null;
  onNavigate?: (page: Page) => void;
}

type ArenaMode = 'pitch' | 'benchmark' | 'speed' | null;
type FilterMode = 'all' | 'recruiting' | 'reviewing' | 'finished';

const MODE_CONFIG = {
  pitch: {
    icon: Lightbulb,
    label: '方案赛马',
    emoji: '💡',
    desc: '提交方案 → 专家评审',
    color: 'from-amber-500/20 to-amber-600/10',
    borderColor: 'border-amber-500/40',
    textColor: 'text-amber-400',
  },
  benchmark: {
    icon: BarChart3,
    label: '榜单打擂',
    emoji: '🏎️',
    desc: '提交模型 → 刷榜跑分',
    color: 'from-blue-500/20 to-blue-600/10',
    borderColor: 'border-blue-500/40',
    textColor: 'text-blue-400',
  },
  speed: {
    icon: Zap,
    label: '极速猎人',
    emoji: '⚡',
    desc: '谁先做完谁拿钱',
    color: 'from-purple-500/20 to-purple-600/10',
    borderColor: 'border-purple-500/40',
    textColor: 'text-purple-400',
  },
};

function getCountdown(deadline: string): { d: number; h: number; m: number; s: number; done: boolean } {
  const end = new Date(deadline).getTime();
  const now = Date.now();
  if (end <= now) return { d: 0, h: 0, m: 0, s: 0, done: true };
  const ms = end - now;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { d, h, m, s, done: false };
}

function formatCountdownDisplay(c: { d: number; h: number; m: number; s: number; done: boolean }): string {
  if (c.done) return '已截止';
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (c.d > 0) return `${c.d}天 ${pad(c.h)}:${pad(c.m)}:${pad(c.s)}`;
  return `${pad(c.h)}:${pad(c.m)}:${pad(c.s)}`;
}

function AnimatedNumber({ value, duration = 1500 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const startValue = displayValue;
    const diff = value - startValue;
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(startValue + diff * easeOut));
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <>{displayValue.toLocaleString()}</>;
}

export const Arena: React.FC<ArenaProps> = ({ session: sessionProp, onNavigate }) => {
  const [session, setSession] = useState<Session | null>(sessionProp ?? null);
  const [arenas, setArenas] = useState<ArenaWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createStep, setCreateStep] = useState<'mode' | 'details'>('mode');
  const [selectedMode, setSelectedMode] = useState<ArenaMode>(null);
  const [selectedArenaId, setSelectedArenaId] = useState<number | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    domain: '',
    contact_info: '',
    total_prize: '',
    deadline: '',
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteArenaId, setDeleteArenaId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type?: 'success' | 'error' }>({ visible: false, message: '' });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (sessionProp !== undefined) setSession(sessionProp);
    else {
      supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
      return () => subscription.unsubscribe();
    }
  }, [sessionProp]);

  const loadArenas = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchArenas();
      setArenas(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载竞技场列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArenas();
  }, []);

  const filteredArenas = useMemo(() => {
    if (filterMode === 'all') return arenas;
    return arenas.filter((a) => a.status === filterMode);
  }, [arenas, filterMode]);

  const totalPrizePool = useMemo(() => {
    return arenas.reduce((sum, a) => sum + a.total_prize, 0);
  }, [arenas]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!selectedMode) {
      setCreateError('请选择竞技模式');
      return;
    }
    const total = Number(formData.total_prize);
    if (!formData.title.trim()) {
      setCreateError('请填写标题');
      return;
    }
    if (!formData.deadline) {
      setCreateError('请选择截止时间');
      return;
    }
    if (Number.isNaN(total) || total < 0) {
      setCreateError('总奖金请填写有效数字');
      return;
    }
    setCreateSubmitting(true);
    try {
      const input: CreateArenaInput = {
        title: formData.title.trim(),
        description: formData.description.trim() || '',
        domain: formData.domain.trim() || null,
        contact_info: formData.contact_info.trim() || null,
        total_prize: total,
        deadline: new Date(formData.deadline).toISOString(),
        mode: selectedMode,
      };
      await createArena(input);
      setCreateModalOpen(false);
      setCreateStep('mode');
      setSelectedMode(null);
      setFormData({ title: '', description: '', domain: '', contact_info: '', total_prize: '', deadline: '' });
      await loadArenas();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : '发布失败');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, arenaId: number) => {
    e.stopPropagation();
    setDeleteArenaId(arenaId);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteArenaId) return;
    setDeleting(true);
    try {
      await deleteArena(deleteArenaId);
      setDeleteModalOpen(false);
      setDeleteArenaId(null);
      setToast({ visible: true, message: '删除成功', type: 'success' });
      setTimeout(() => setToast({ visible: false, message: '' }), 2000);
      await loadArenas();
    } catch (e) {
      console.error('Delete failed:', e);
      setToast({ visible: true, message: '删除失败，请重试', type: 'error' });
      setTimeout(() => setToast({ visible: false, message: '' }), 2000);
    } finally {
      setDeleting(false);
    }
  };

  if (selectedArenaId != null) {
    return (
      <ArenaDetail
        arenaId={selectedArenaId}
        session={session}
        onBack={() => setSelectedArenaId(null)}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 pb-20">
      {/* Hero Banner */}
      <div className="relative overflow-hidden border-b border-amber-500/20">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/10 via-slate-900 to-slate-900"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-transparent"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-medium mb-6">
              <Sparkles size={16} />
              碳硅竞技场
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-4 tracking-tight">
              <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">
                以智慧换取荣耀
              </span>
              <br />
              <span className="text-white">用代码铸造传奇</span>
            </h1>
            <div className="mt-12 flex items-center justify-center gap-8">
              <div className="text-center">
                {loading ? (
                  <div className="text-3xl md:text-5xl font-black text-amber-400 tabular-nums">
                    ¥0
                  </div>
                ) : (
                  <div className="text-3xl md:text-5xl font-black text-amber-400 tabular-nums">
                    ¥<AnimatedNumber value={totalPrizePool} />
                  </div>
                )}
                <div className="text-slate-400 text-sm mt-2">总奖金池</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        {/* Filter Tabs */}
        <div className="flex items-center gap-3 mb-8 overflow-x-auto pb-2">
          <button
            onClick={() => setFilterMode('all')}
            className={`shrink-0 px-6 py-2.5 rounded-xl font-medium transition-all ${
              filterMode === 'all'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-lg shadow-amber-500/10'
                : 'bg-slate-900/50 text-slate-400 border border-slate-700 hover:border-slate-600'
            }`}
          >
            全部
          </button>
          {(['recruiting', 'reviewing', 'finished'] as const).map((status) => {
            const statusConfig = {
              recruiting: { label: '进行中', color: 'bg-green-500/20 text-green-400 border-green-500/40' },
              reviewing: { label: '评审中', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
              finished: { label: '已完成', color: 'bg-slate-500/20 text-slate-400 border-slate-500/40' },
            };
            return (
              <button
                key={status}
                onClick={() => setFilterMode(status)}
                className={`shrink-0 px-6 py-2.5 rounded-xl font-medium transition-all ${
                  filterMode === status
                    ? `${statusConfig[status].color} border shadow-lg`
                    : 'bg-slate-900/50 text-slate-400 border border-slate-700 hover:border-slate-600'
                }`}
              >
                {statusConfig[status].label}
              </button>
            );
          })}
          {session && (
            <button
              onClick={() => {
                setCreateModalOpen(true);
                setCreateStep('mode');
                setSelectedMode(null);
              }}
              className="ml-auto shrink-0 flex items-center gap-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-amber-500/25 border border-amber-400/20"
            >
              <Plus size={18} />
              发布竞技场
            </button>
          )}
        </div>

        {loading && (
          <div className="text-slate-400 py-20 text-center">加载中...</div>
        )}
        {error && (
          <div className="text-amber-400/90 py-4 text-center">{error}</div>
        )}
        {!loading && !error && filteredArenas.length === 0 && (
          <div className="text-slate-400 py-20 text-center">
            {filterMode === 'all' ? '暂无竞技场，快来发布一个吧' : `暂无${filterMode === 'recruiting' ? '进行中' : filterMode === 'reviewing' ? '评审中' : '已完成'}的竞技场`}
          </div>
        )}

        {!loading && !error && filteredArenas.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArenas.map((arena) => {
              const countdown = getCountdown(arena.deadline);
              const countdownStr = formatCountdownDisplay(countdown);
              const mode = arena.mode;
              const config = mode ? MODE_CONFIG[mode] : null;
              const ModeIcon = config?.icon || Trophy;
              return (
                <div
                  key={arena.id}
                  onClick={() => setSelectedArenaId(arena.id)}
                  className="group text-left rounded-2xl border transition-all p-6 bg-slate-900/50 backdrop-blur-md border-slate-700 hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:bg-slate-900/70 relative overflow-hidden cursor-pointer"
                >
                  {/* Mode Badge */}
                  {mode && config && (
                    <div className={`absolute top-4 left-4 px-3 py-1.5 rounded-full ${config.color} ${config.borderColor} border flex items-center gap-1.5 text-xs font-medium ${config.textColor}`}>
                      <ModeIcon size={14} />
                      {config.emoji} {config.label}
                    </div>
                  )}

                  {/* Action Buttons - Top Right */}
                  <div className="absolute top-4 right-4 flex items-center gap-2 z-10" onClick={e => e.stopPropagation()}>
                    {session && session.user?.id === arena.creator_id && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(e, arena.id)}
                        className="p-1.5 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-colors"
                        title="删除竞技场"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Status Badge */}
                  {arena.status === 'finished' && (
                    <div className="absolute top-4 right-16 px-3 py-1.5 rounded-full bg-slate-600/80 text-slate-300 border border-slate-500 text-xs font-medium">
                      已结束
                    </div>
                  )}
                  {arena.status === 'reviewing' && (
                    <div className="absolute top-4 right-16 px-3 py-1.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40 text-xs font-medium">
                      评审中
                    </div>
                  )}

                  <div className="mt-12 mb-4">
                    <h3 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-2 mb-2">
                      {arena.title}
                    </h3>
                    {arena.domain && (
                      <span className="inline-block text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        {arena.domain}
                      </span>
                    )}
                  </div>

                  <p className="text-slate-400 text-sm line-clamp-2 mb-6">{arena.description || '暂无说明'}</p>

                  {/* Prize & Countdown */}
                  <div className="flex items-end justify-between gap-4 mb-4">
                    <div>
                      <div className="text-3xl font-black text-amber-400 tabular-nums leading-none">
                        ¥{arena.total_prize.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">总奖金</div>
                    </div>
                    <div className={`text-right tabular-nums ${countdown.done ? 'text-slate-500' : 'text-amber-400/90'}`}>
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <Clock size={14} />
                        {countdownStr}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar / Participants */}
                  <div className="pt-4 border-t border-slate-700/50">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Users size={14} />
                      <span>已有 {(arena as ArenaWithCount).submission_count || 0} 人参赛</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal - Step 1: Mode Selection */}
      {createModalOpen && createStep === 'mode' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { setCreateModalOpen(false); setCreateError(null); }} />
          <div className="relative bg-slate-900 w-full max-w-3xl rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
            <div className="bg-slate-950 border-b border-slate-700 p-6 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">选择竞技模式</h3>
              <button type="button" onClick={() => { setCreateModalOpen(false); setCreateError(null); }} className="text-slate-500 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['pitch', 'benchmark', 'speed'] as const).map((mode) => {
                const config = MODE_CONFIG[mode];
                const Icon = config.icon;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setSelectedMode(mode);
                      setCreateStep('details');
                    }}
                    className={`p-6 rounded-xl border transition-all text-left ${
                      selectedMode === mode
                        ? `${config.color} ${config.borderColor} border-2 ${config.textColor} shadow-lg`
                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg ${selectedMode === mode ? 'bg-amber-500/20' : 'bg-slate-700/50'}`}>
                        <Icon size={24} className={selectedMode === mode ? config.textColor : 'text-slate-400'} />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-white">{config.emoji} {config.label}</div>
                        <div className="text-xs text-slate-400">{config.desc}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal - Step 2: Details Form */}
      {createModalOpen && createStep === 'details' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { setCreateModalOpen(false); setCreateError(null); }} />
          <div className="relative bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
            <div className="bg-slate-950 border-b border-slate-700 p-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">发布竞技场</h3>
                {selectedMode && (
                  <div className="text-xs text-slate-400 mt-1">
                    {MODE_CONFIG[selectedMode].emoji} {MODE_CONFIG[selectedMode].label}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateStep('mode');
                    setSelectedMode(null);
                  }}
                  className="text-slate-500 hover:text-white text-sm"
                >
                  返回
                </button>
                <button type="button" onClick={() => { setCreateModalOpen(false); setCreateError(null); }} className="text-slate-500 hover:text-white">
                  <X size={22} />
                </button>
              </div>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {createError && <p className="text-amber-400 text-sm">{createError}</p>}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">标题 *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((d) => ({ ...d, title: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500"
                  placeholder="竞技场名称"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">说明</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((d) => ({ ...d, description: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500 resize-none"
                  rows={3}
                  placeholder="规则与要求"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">领域</label>
                <input
                  type="text"
                  value={formData.domain}
                  onChange={(e) => setFormData((d) => ({ ...d, domain: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500"
                  placeholder="如：科技、健康、宠物"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">联系方式</label>
                <input
                  type="text"
                  value={formData.contact_info}
                  onChange={(e) => setFormData((d) => ({ ...d, contact_info: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500"
                  placeholder="选填"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">总奖金（元）*</label>
                <input
                  type="number"
                  min={0}
                  value={formData.total_prize}
                  onChange={(e) => setFormData((d) => ({ ...d, total_prize: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">截止时间 *</label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={formData.deadline}
                    onChange={(e) => setFormData((d) => ({ ...d, deadline: e.target.value }))}
                    placeholder="点击选择日期和时间"
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500 appearance-none cursor-pointer placeholder:text-slate-500"
                    style={{ colorScheme: 'dark' }}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={createSubmitting}
                className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 text-white font-medium py-3 rounded-xl shadow-lg shadow-amber-500/20"
              >
                {createSubmitting ? '发布中...' : '发布'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setDeleteModalOpen(false)} />
          <div className="relative bg-slate-900 w-full max-w-md rounded-2xl border border-red-500/30 shadow-2xl overflow-hidden">
            <div className="bg-slate-950 border-b border-red-500/30 p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-red-400" size={20} />
                <h3 className="text-lg font-bold text-white">确认删除</h3>
              </div>
              <button type="button" onClick={() => setDeleteModalOpen(false)} className="text-slate-500 hover:text-white">
                <X size={22} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-300 mb-4">确定要删除此竞技场吗？此操作不可撤销：</p>
              <ul className="text-slate-400 text-sm space-y-2 mb-6 list-disc list-inside">
                <li>竞技场及所有投稿将被永久删除</li>
                <li>已发放的奖金不受影响</li>
              </ul>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      删除中...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      确认删除
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.visible && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto max-w-lg w-full mx-4">
            <div className={`rounded-xl border-2 p-5 px-6 shadow-2xl ${toast.type === 'error' ? 'bg-rose-900 border-rose-500' : 'bg-emerald-900 border-emerald-500'} text-white text-center`}>
              <div className="text-lg font-semibold">{toast.message}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
