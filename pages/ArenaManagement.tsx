import React, { useEffect, useState } from 'react';
import { supabase } from '../src/supabaseClient';
import { Page } from '../types';
import { Shield, Clock, CheckCircle, XCircle, Users, Loader2, Trophy } from 'lucide-react';
import type { Arena } from '../types/supabase';

interface ArenaManagementProps {
  onNavigate: (page: Page) => void;
}

export const ArenaManagement: React.FC<ArenaManagementProps> = ({ onNavigate }) => {
  const [pendingArenas, setPendingArenas] = useState<Arena[]>([]);
  const [approvedArenas, setApprovedArenas] = useState<Arena[]>([]);
  const [loading, setLoading] = useState(true);
  const [isArenaAdmin, setIsArenaAdmin] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');

  useEffect(() => {
    const checkAdminAndLoad = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        onNavigate(Page.HOME);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('is_arena_admin')
        .eq('id', user.id)
        .single();

      if (!data?.is_arena_admin) {
        onNavigate(Page.HOME);
        return;
      }

      setIsArenaAdmin(true);
      setCurrentAdminId(user.id);
      await loadArenas();
    };

    checkAdminAndLoad();
  }, [onNavigate]);

  const loadArenas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('arenas')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPendingArenas(data.filter((a: Arena) => !a.is_approved));
      setApprovedArenas(data.filter((a: Arena) => a.is_approved));
    }
    setLoading(false);
  };

  const handleApprove = async (arenaId: number) => {
    if (!currentAdminId) return;
    setProcessingId(arenaId);

    const { error } = await supabase
      .from('arenas')
      .update({
        is_approved: true,
        approved_at: new Date().toISOString(),
        approved_by: currentAdminId
      })
      .eq('id', arenaId);

    if (error) {
      setToast({ type: 'error', message: '审核失败: ' + error.message });
    } else {
      setToast({ type: 'success', message: '已通过审核' });
      await loadArenas();
    }
    setProcessingId(null);
    setTimeout(() => setToast(null), 3000);
  };

  const handleReject = async (arenaId: number) => {
    if (!currentAdminId) return;
    setProcessingId(arenaId);

    const { error } = await supabase
      .from('arenas')
      .delete()
      .eq('id', arenaId);

    if (error) {
      setToast({ type: 'error', message: '拒绝失败: ' + error.message });
    } else {
      setToast({ type: 'success', message: '已拒绝并删除' });
      await loadArenas();
    }
    setProcessingId(null);
    setTimeout(() => setToast(null), 3000);
  };

  const handleUnapprove = async (arenaId: number) => {
    setProcessingId(arenaId);

    const { error } = await supabase
      .from('arenas')
      .update({
        is_approved: false,
        approved_at: null,
        approved_by: null
      })
      .eq('id', arenaId);

    if (error) {
      setToast({ type: 'error', message: '取消审核失败: ' + error.message });
    } else {
      setToast({ type: 'success', message: '已取消审核' });
      await loadArenas();
    }
    setProcessingId(null);
    setTimeout(() => setToast(null), 3000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCountdown = (deadline: string) => {
    const end = new Date(deadline).getTime();
    const now = Date.now();
    if (end <= now) return '已截止';
    const ms = end - now;
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    if (d > 0) return `${d}天 ${h}小时`;
    return `${h}小时`;
  };

  const displayedArenas = activeTab === 'pending' ? pendingArenas : approvedArenas;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">竞技场审核管理</h1>
            <p className="text-slate-400 text-sm">审核用户发布的竞技场</p>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-green-900/30 text-green-400 border border-green-700'
              : 'bg-red-900/30 text-red-400 border border-red-700'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-900/50 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">待审核</p>
              <p className="text-2xl font-bold text-white">{pendingArenas.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-900/50 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">已通过</p>
              <p className="text-2xl font-bold text-white">{approvedArenas.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-cyan-900/50 flex items-center justify-center">
              <Users className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">总竞技场</p>
              <p className="text-2xl font-bold text-white">{pendingArenas.length + approvedArenas.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-700 mb-6">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 text-base font-medium transition-all ${
              activeTab === 'pending'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-400 hover:text-white border-b-2 border-transparent'
            }`}
          >
            待审核 ({pendingArenas.length})
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`pb-3 text-base font-medium transition-all ${
              activeTab === 'approved'
                ? 'text-green-400 border-b-2 border-green-400'
                : 'text-slate-400 hover:text-white border-b-2 border-transparent'
            }`}
          >
            已通过 ({approvedArenas.length})
          </button>
        </div>
      </div>

      {/* Arena List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      ) : displayedArenas.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {activeTab === 'pending' ? '暂无待审核的竞技场' : '暂无已通过的竞技场'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {displayedArenas.map((arena) => (
            <div
              key={arena.id}
              className={`rounded-2xl border p-6 bg-slate-800/50 backdrop-blur-md transition-all ${
                arena.is_approved
                  ? 'border-green-500/30'
                  : 'border-amber-500/30'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-2">{arena.title}</h3>
                  {arena.domain && (
                    <span className="inline-block text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      {arena.domain}
                    </span>
                  )}
                </div>
                <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  arena.is_approved
                    ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}>
                  {arena.is_approved ? '已通过' : '待审核'}
                </div>
              </div>

              <p className="text-slate-400 text-sm line-clamp-2 mb-4">
                {arena.description || '暂无说明'}
              </p>

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <span className="text-slate-500">奖金:</span>
                  <span className="text-amber-400 font-bold ml-1">
                    ¥{arena.total_prize.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">截止:</span>
                  <span className="text-slate-300 ml-1">{getCountdown(arena.deadline)}</span>
                </div>
                <div>
                  <span className="text-slate-500">模式:</span>
                  <span className="text-slate-300 ml-1">{arena.mode || '未设置'}</span>
                </div>
                <div>
                  <span className="text-slate-500">发布:</span>
                  <span className="text-slate-300 ml-1">{formatDate(arena.created_at)}</span>
                </div>
              </div>

              {arena.approved_at && (
                <div className="text-xs text-slate-500 mb-4">
                  审核时间: {formatDate(arena.approved_at)}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-700">
                {arena.is_approved ? (
                  <>
                    <button
                      onClick={() => handleUnapprove(arena.id)}
                      disabled={processingId === arena.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-600/30 text-amber-400 hover:bg-amber-600/50 border border-amber-500/30 transition-colors disabled:opacity-50"
                    >
                      {processingId === arena.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      取消审核
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleApprove(arena.id)}
                      disabled={processingId === arena.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-600/30 text-green-400 hover:bg-green-600/50 border border-green-500/30 transition-colors disabled:opacity-50"
                    >
                      {processingId === arena.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      通过
                    </button>
                    <button
                      onClick={() => handleReject(arena.id)}
                      disabled={processingId === arena.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600/30 text-red-400 hover:bg-red-600/50 border border-red-500/30 transition-colors disabled:opacity-50"
                    >
                      {processingId === arena.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      拒绝
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
