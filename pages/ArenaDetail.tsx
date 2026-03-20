import React, { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowLeft, Send, FileText, Lightbulb, BarChart3, Zap, PowerOff, AlertTriangle, X } from 'lucide-react';
import {
  fetchArenaDetail,
  fetchSubmissions,
  updateArenaStatus,
} from '../src/api/arena';
import type { Arena as ArenaType, ArenaSubmission } from '../types/supabase';
import { supabase } from '../src/supabaseClient';
import { Page } from '../types';
import { ArenaRuleCard } from '../components/ArenaRuleCard';
import { SubmitSolutionModal } from '../components/SubmitSolutionModal';
import { CreatorDashboard } from '../components/CreatorDashboard';

interface ArenaDetailProps {
  arenaId: number;
  session: Session | null;
  onBack: () => void;
  onNavigate?: (page: Page) => void;
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待评审',
  winner: '已优胜',
  runner_up: 'Runner-up',
  rejected: '未通过',
};

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

export const ArenaDetail: React.FC<ArenaDetailProps> = ({
  arenaId,
  session,
  onBack,
  onNavigate,
}) => {
  const [arena, setArena] = useState<ArenaType | null>(null);
  const [submissions, setSubmissions] = useState<ArenaSubmission[]>([]);
  const [mySubmission, setMySubmission] = useState<ArenaSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [offlineModalOpen, setOfflineModalOpen] = useState(false);
  const [offlining, setOfflining] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type?: 'success' | 'error' | 'info' }>({ visible: false, message: '', type: 'info' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type }), 3000);
  };

  const isCreator = session?.user?.id && arena?.creator_id ? arena.creator_id === session.user.id : false;

  const loadArena = async () => {
    setLoading(true);
    setError(null);
    try {
      const a = await fetchArenaDetail(arenaId);
      setArena(a);
      if (!a) {
        setError('竞技场不存在');
        setLoading(false);
        return;
      }
      if (session?.user?.id) {
        if (a.creator_id === session.user.id) {
          const list = await fetchSubmissions(arenaId);
          setSubmissions(list);
        } else {
          const { data } = await supabase
            .from('arena_submissions')
            .select('*')
            .eq('arena_id', arenaId)
            .eq('worker_id', session.user.id)
            .maybeSingle();
          setMySubmission((data as ArenaSubmission) ?? null);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArena();
  }, [arenaId]);

  const handleSubmissionSuccess = async () => {
    try {
      // 刷新我的投稿状态
      if (session && session.user && !isCreator) {
        const { data } = await supabase
          .from('arena_submissions')
          .select('*')
          .eq('arena_id', arenaId)
          .eq('worker_id', session.user.id)
          .maybeSingle();
        setMySubmission((data as ArenaSubmission) ?? null);
      }
    } catch (err) {
      console.error('Failed to refresh submission:', err);
    }
  };

  const handleDashboardUpdate = async () => {
    try {
      // 刷新投稿列表
      if (session && session.user && isCreator && arena) {
        const list = await fetchSubmissions(arenaId);
        setSubmissions(list);
        // 同时刷新竞技场信息（状态可能已更新为 finished）
        const a = await fetchArenaDetail(arenaId);
        if (a) setArena(a);
      }
    } catch (err) {
      console.error('Failed to refresh dashboard:', err);
    }
  };

  const handleOffline = async () => {
    setOfflining(true);
    try {
      await updateArenaStatus(arenaId, 'finished');
      setOfflineModalOpen(false);
      // 下架成功后返回列表
      onBack();
    } catch (err) {
      console.error('Failed to offline arena:', err);
      showToast('下架失败，请重试', 'error');
    } finally {
      setOfflining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-8 pb-20">
        <div className="max-w-4xl mx-auto px-4">
          <button type="button" onClick={onBack} className="text-slate-400 hover:text-amber-400 mb-6 flex items-center gap-2 transition-colors">
            <ArrowLeft size={18} /> 返回列表
          </button>
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-4"></div>
            <p className="text-amber-400 text-lg font-medium animate-pulse">加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !arena) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-8 pb-20">
        <div className="max-w-4xl mx-auto px-4">
          <button type="button" onClick={onBack} className="text-slate-400 hover:text-amber-400 mb-6 flex items-center gap-2 transition-colors">
            <ArrowLeft size={18} /> 返回列表
          </button>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-red-400 font-medium">{error || '未找到竞技场'}</p>
          </div>
        </div>
      </div>
    );
  }

  // 双重安全检查：确保 arena 存在
  if (!arena) {
    return null;
  }

  // 最终安全检查
  if (!arena) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-8 pb-20">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={onBack}
            className="text-slate-400 hover:text-amber-400 flex items-center gap-2 transition-colors"
          >
            <ArrowLeft size={18} /> 返回列表
          </button>
          {isCreator && arena?.status !== 'finished' && (
            <button
              type="button"
              onClick={() => setOfflineModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl font-medium transition-colors"
            >
              <PowerOff size={16} />
              下架竞技场
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-800/90 p-6 mb-8 shadow-xl shadow-black/20">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white mb-2">{arena?.title || '加载中...'}</h1>
              {arena?.mode && MODE_CONFIG[arena.mode] && (() => {
                const config = MODE_CONFIG[arena.mode!];
                const Icon = config.icon;
                return (
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${config.color} ${config.borderColor} border ${config.textColor} text-sm font-medium mb-2`}>
                    <Icon size={16} />
                    {config.emoji} {config.label}
                  </div>
                );
              })()}
            </div>
            {arena?.domain && (
              <span className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                {arena.domain}
              </span>
            )}
          </div>
          <p className="text-slate-400 whitespace-pre-wrap mb-6">{arena?.description || '暂无说明'}</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-amber-400 font-bold">¥{arena?.total_prize?.toLocaleString() || '0'} 总奖金</span>
            {arena?.prize_structure && typeof arena.prize_structure === 'object' && Object.keys(arena.prize_structure).length > 0 && (
              <span className="text-slate-400">
                奖金结构：{Object.entries(arena.prize_structure).map(([k, v]) => `${k}: ¥${v}`).join('，')}
              </span>
            )}
          </div>
        </div>

        {/* 规则说明栏 */}
        {arena?.mode && <ArenaRuleCard mode={arena.mode} />}

        {/* 游客 */}
        {!session && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-6 text-center">
            <p className="text-slate-400 mb-4">登录后参赛</p>
            <button
              type="button"
              onClick={() => onNavigate?.(Page.REGISTER)}
              className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-amber-500/20"
            >
              登录 / 注册
            </button>
          </div>
        )}

        {/* 工人：未投稿 */}
        {session && !isCreator && !mySubmission && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/10 mb-6 border border-amber-500/20">
              <Send size={36} className="text-amber-400" />
            </div>
            <h3 className="text-white font-bold text-lg mb-2">提交你的方案，参与竞技</h3>
            <p className="text-slate-400 text-sm mb-6">展示你的创意，赢取丰厚奖金</p>
            <button
              type="button"
              onClick={() => setSubmitModalOpen(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all hover:-translate-y-0.5"
            >
              <Send size={20} /> 立即投稿
            </button>
          </div>
        )}

        {/* 工人：已投稿 */}
        {session && !isCreator && mySubmission && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold flex items-center gap-2">
                <FileText size={18} /> 我的投稿状态
              </h3>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                mySubmission.status === 'winner' 
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : mySubmission.status === 'pending'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-slate-700/50 text-slate-400 border border-slate-600'
              }`}>
                {STATUS_LABEL[mySubmission.status] ?? mySubmission.status}
              </div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 mb-4 border border-slate-700/50">
              <p className="text-slate-200 text-sm leading-relaxed mb-3">{mySubmission.summary || '—'}</p>
              {mySubmission.file_url && (
                <a 
                  href={mySubmission.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center gap-1.5 text-amber-400 text-sm hover:text-amber-300 hover:underline transition-colors"
                >
                  <FileText size={14} />
                  查看附件
                </a>
              )}
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
              <div className="text-xs text-slate-500">
                投稿时间：{new Date(mySubmission.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </div>
              {mySubmission.score != null && (
                <div className="text-amber-400 font-semibold">
                  得分：{mySubmission.score} 分
                </div>
              )}
            </div>
            {mySubmission.admin_feedback && (
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-xs text-blue-400 font-medium mb-1">评审反馈</p>
                <p className="text-sm text-slate-300">{mySubmission.admin_feedback}</p>
              </div>
            )}
          </div>
        )}

        {/* 创建者：投稿管理 */}
        {session && isCreator && (
          <CreatorDashboard
            arenaId={arenaId}
            submissions={submissions}
            onUpdate={handleDashboardUpdate}
          />
        )}

        {/* 投稿弹窗 */}
        <SubmitSolutionModal
          arenaId={arenaId}
          isOpen={submitModalOpen}
          onClose={() => setSubmitModalOpen(false)}
          onSuccess={handleSubmissionSuccess}
        />

        {/* 下架确认弹窗 */}
        {offlineModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setOfflineModalOpen(false)}
            />
            <div className="relative bg-slate-900 w-full max-w-md rounded-2xl border border-red-500/30 shadow-2xl overflow-hidden">
              <div className="bg-slate-950 border-b border-red-500/30 p-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="text-red-400" size={20} />
                  <h3 className="text-lg font-bold text-white">确认下架</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOfflineModalOpen(false)}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <X size={22} />
                </button>
              </div>
              <div className="p-6">
                <p className="text-slate-300 mb-4">
                  确定要下架此竞技场吗？下架后：
                </p>
                <ul className="text-slate-400 text-sm space-y-2 mb-6 list-disc list-inside">
                  <li>竞技场将从列表中移除</li>
                  <li>参赛者将无法继续投稿</li>
                  <li>已提交的投稿将保留</li>
                </ul>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setOfflineModalOpen(false)}
                    className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleOffline}
                    disabled={offlining}
                    className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {offlining ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        下架中...
                      </>
                    ) : (
                      <>
                        <PowerOff size={16} />
                        确认下架
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
          <div style={{ zIndex: 9999 }} className="fixed inset-0 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto max-w-lg w-full mx-4">
              <div className={`rounded-xl border-2 p-5 px-6 shadow-2xl ${toast.type === 'error' ? 'bg-rose-900 border-rose-500' : toast.type === 'success' ? 'bg-emerald-900 border-emerald-500' : 'bg-slate-800 border-cyan-500'} text-white text-center transform transition duration-200 scale-100`}>
                <div className="text-lg font-semibold">{toast.message}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
