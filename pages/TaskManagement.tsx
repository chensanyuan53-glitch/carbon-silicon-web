import React, { useEffect, useState } from 'react';
import { supabase } from '../src/supabaseClient';
import { Page } from '../types';
import { Shield, CheckCircle, XCircle, Loader2, DollarSign, Users, Clock, Home } from 'lucide-react';

interface TaskItem {
  id: string;
  type: 'bounty' | 'team';
  title: string;
  category: string;
  content: string;
  reward: string;
  contact: string;
  user_id: string;
  created_at: string;
  is_active: boolean;
  is_approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
  team_size: number;
  current_team_count: number;
}

interface TaskManagementProps {
  onNavigate: (page: Page) => void;
}

export const TaskManagement: React.FC<TaskManagementProps> = ({ onNavigate }) => {
  const [pendingTasks, setPendingTasks] = useState<TaskItem[]>([]);
  const [approvedTasks, setApprovedTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
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

      setIsAdmin(true);
      setCurrentAdminId(user.id);
      await loadTasks();
    };

    checkAdminAndLoad();
  }, [onNavigate]);

  const loadTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks_reward')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPendingTasks(data.filter((t: TaskItem) => !t.is_approved));
      setApprovedTasks(data.filter((t: TaskItem) => t.is_approved));
    }
    setLoading(false);
  };

  const handleApprove = async (taskId: string) => {
    if (!currentAdminId) return;
    setProcessingId(taskId);

    const { error } = await supabase
      .from('tasks_reward')
      .update({
        is_approved: true,
        approved_at: new Date().toISOString(),
        approved_by: currentAdminId
      })
      .eq('id', taskId);

    if (error) {
      setToast({ type: 'error', message: '审核失败: ' + error.message });
    } else {
      setToast({ type: 'success', message: '已通过审核' });
      await loadTasks();
    }
    setProcessingId(null);
    setTimeout(() => setToast(null), 3000);
  };

  const handleReject = async (taskId: string) => {
    if (!currentAdminId) return;
    setProcessingId(taskId);

    // 删除任务
    const { error } = await supabase
      .from('tasks_reward')
      .delete()
      .eq('id', taskId);

    if (error) {
      setToast({ type: 'error', message: '拒绝失败: ' + error.message });
    } else {
      setToast({ type: 'success', message: '已拒绝并删除' });
      await loadTasks();
    }
    setProcessingId(null);
    setTimeout(() => setToast(null), 3000);
  };

  const handleUnapprove = async (taskId: string) => {
    setProcessingId(taskId);

    const { error } = await supabase
      .from('tasks_reward')
      .update({
        is_approved: false,
        approved_at: null,
        approved_by: null
      })
      .eq('id', taskId);

    if (error) {
      setToast({ type: 'error', message: '取消审核失败: ' + error.message });
    } else {
      setToast({ type: 'success', message: '已取消审核' });
      await loadTasks();
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

  const getTimeLeft = (createdAt: string) => {
    const expireTime = new Date(createdAt).getTime() + 12 * 60 * 60 * 1000;
    const now = Date.now();
    if (expireTime <= now) return '已过期';
    const diff = expireTime - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const displayedTasks = activeTab === 'pending' ? pendingTasks : approvedTasks;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">任务审核管理</h1>
            <p className="text-slate-400 text-sm">审核用户发布的任务</p>
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
            <div className="w-12 h-12 rounded-lg bg-orange-900/50 flex items-center justify-center">
              <Clock className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">待审核</p>
              <p className="text-2xl font-bold text-white">{pendingTasks.length}</p>
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
              <p className="text-2xl font-bold text-white">{approvedTasks.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-cyan-900/50 flex items-center justify-center">
              <Users className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">总任务数</p>
              <p className="text-2xl font-bold text-white">{pendingTasks.length + approvedTasks.length}</p>
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
                ? 'text-orange-400 border-b-2 border-orange-400'
                : 'text-slate-400 hover:text-white border-b-2 border-transparent'
            }`}
          >
            待审核 ({pendingTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`pb-3 text-base font-medium transition-all ${
              activeTab === 'approved'
                ? 'text-green-400 border-b-2 border-green-400'
                : 'text-slate-400 hover:text-white border-b-2 border-transparent'
            }`}
          >
            已通过 ({approvedTasks.length})
          </button>
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
        </div>
      ) : displayedTasks.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {activeTab === 'pending' ? '暂无待审核的任务' : '暂无已通过的任务'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {displayedTasks.map((task) => (
            <div
              key={task.id}
              className={`rounded-2xl border p-6 bg-slate-800/50 backdrop-blur-md transition-all ${
                task.is_approved
                  ? 'border-green-500/30'
                  : 'border-orange-500/30'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${
                      task.type === 'bounty'
                        ? 'text-yellow-500 border-yellow-500/20 bg-yellow-500/5'
                        : 'text-cyan-500 border-cyan-500/20 bg-cyan-500/5'
                    }`}>
                      {task.type === 'bounty' ? '💰 悬赏' : '🤝 组队'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700/50 text-slate-300">
                      <Home size={12} className="inline mr-1" />
                      {task.category}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{task.title}</h3>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  task.is_approved
                    ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                    : 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                }`}>
                  {task.is_approved ? '已通过' : '待审核'}
                </div>
              </div>

              <p className="text-slate-400 text-sm line-clamp-2 mb-4">
                {task.content || '暂无描述'}
              </p>

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <span className="text-slate-500">报酬:</span>
                  <span className="text-orange-400 font-bold ml-1">
                    {task.type === 'bounty' ? `¥${task.reward}` : task.reward}
                  </span>
                </div>
                {task.type === 'team' && (
                  <div>
                    <span className="text-slate-500">队伍:</span>
                    <span className="text-cyan-400 font-bold ml-1">
                      {task.current_team_count || 1}/{task.team_size}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">剩余:</span>
                  <span className="text-slate-300 ml-1">{getTimeLeft(task.created_at)}</span>
                </div>
                <div>
                  <span className="text-slate-500">发布:</span>
                  <span className="text-slate-300 ml-1">{formatDate(task.created_at)}</span>
                </div>
              </div>

              {task.approved_at && (
                <div className="text-xs text-slate-500 mb-4">
                  审核时间: {formatDate(task.approved_at)}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-700">
                {task.is_approved ? (
                  <>
                    <button
                      onClick={() => handleUnapprove(task.id)}
                      disabled={processingId === task.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-orange-600/30 text-orange-400 hover:bg-orange-600/50 border border-orange-500/30 transition-colors disabled:opacity-50"
                    >
                      {processingId === task.id ? (
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
                      onClick={() => handleApprove(task.id)}
                      disabled={processingId === task.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-600/30 text-green-400 hover:bg-green-600/50 border border-green-500/30 transition-colors disabled:opacity-50"
                    >
                      {processingId === task.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      通过
                    </button>
                    <button
                      onClick={() => handleReject(task.id)}
                      disabled={processingId === task.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600/30 text-red-400 hover:bg-red-600/50 border border-red-500/30 transition-colors disabled:opacity-50"
                    >
                      {processingId === task.id ? (
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
