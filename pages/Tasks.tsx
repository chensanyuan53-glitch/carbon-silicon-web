import React, { useCallback, useEffect, useState, useRef } from 'react';
import { supabase } from '../src/supabaseClient';
import {
  Plus, Clock, Home, X, Upload, Trash2, Smartphone, MessageCircle, ChevronDown, CheckCircle2, AlertCircle, EyeOff, AlertTriangle, RefreshCw
} from 'lucide-react';

// --- 类型定义 ---
type TaskType = 'bounty' | 'team';
type DomainType = '家装' | '农业' | '能源' | '职场' | '健康' | '宠物';

interface TaskItem {
  id: string;
  type: TaskType;
  title: string;
  domain: DomainType;
  desc: string;
  rewardValue: string;
  displayTime: string;
  createdAt: string; // 核心：用于计算倒计时的原始时间
  contact: string;
  user_id: string;
  isOwner?: boolean;
  isActive?: boolean;
}

// --- 倒计时计算工具函数 ---
const calculateTimeLeft = (createdAt: string) => {
  const now = Date.now();
  const createdTime = Date.parse(createdAt);
  if (isNaN(createdTime)) return '已过期';

  const expireTime = createdTime + 12 * 60 * 60 * 1000; // 严格 12 小时
  const difference = expireTime - now;
  if (difference <= 0) return '已过期';

  const hours = Math.floor(difference / (1000 * 60 * 60));
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

interface TasksProps {
  onOpenChat?: (chat: {
    taskId: string;
    taskTitle: string;
    otherUserId: string;
    otherUserName: string;
    currentUserId: string;
  }) => void;
}

export const Tasks: React.FC<TasksProps> = ({ onOpenChat }) => {
  // --- 状态管理 ---
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'bounty' | 'team' | 'mine'>('all');
  const [filterDomain, setFilterDomain] = useState<'all' | DomainType>('all');
  const [currentTime, setCurrentTime] = useState(new Date().getTime()); // 用于驱动 UI 倒计时
  const [isNewUserLocked, setIsNewUserLocked] = useState(false); // 新注册用户 24 小时大额任务锁定
  const [personalTab, setPersonalTab] = useState<'posted' | 'claimed'>('posted');
  const [claimedTaskIds, setClaimedTaskIds] = useState<string[]>([]);
  const [hiddenTaskIds, setHiddenTaskIds] = useState<string[]>([]);
  const hiddenDeletedRef = useRef<string[]>([]);

  // 弹窗状态
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [activeContact, setActiveContact] = useState<{ wechat?: string; phone?: string; qr?: string } | null>(null);
  const [pendingClaimTask, setPendingClaimTask] = useState<TaskItem | null>(null);
  const [confirmingClaim, setConfirmingClaim] = useState(false);

  // 聊天对话框状态
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // 获取当前用户ID
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    desc: string;
    actionType: 'delete' | 'off' | 'renew' | 'claim';
    taskId: string;
  }>({ isOpen: false, title: '', desc: '', actionType: 'off', taskId: '' });

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [postTab, setPostTab] = useState<TaskType>('bounty');
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [postForm, setPostForm] = useState({
    title: '', domain: '家装' as DomainType, reward: '', desc: '', wechat: '', phone: '', qrFile: null as File | null, qrPreview: ''
  });

  const showNotice = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- 1. 定时器：每分钟刷新一次 UI 上的时间 ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().getTime()), 60000);
    return () => clearInterval(timer);
  }, []);

  // --- 2. 获取数据逻辑 ---
  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // 检查是否为注册不满 24 小时的新用户
      const isNewUser = !!user && (Date.now() - Date.parse(user.created_at) < 24 * 60 * 60 * 1000);
      setIsNewUserLocked(isNewUser);
      if (isNewUser) {
        showNotice('新注册用户需等待 24 小时方可解锁大额任务。', 'error');
      }
      const { data, error } = await supabase
        .from('tasks_reward')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const now = new Date().getTime();
        const formatted: TaskItem[] = data.map((row: Record<string, unknown> & { created_at?: string | Date }) => {
          // 规范 created_at：若无时区信息则假定为 UTC 并追加 'Z'，若是 Date 对象则转为 ISO
          let createdIso: string;
          const raw = row.created_at;
          if (typeof raw === 'string') {
            createdIso = /[Zz]|[+\-]\d{2}:?\d{2}$/.test(raw) ? raw : raw + 'Z';
          } else if (raw instanceof Date) {
            createdIso = raw.toISOString();
          } else {
            createdIso = new Date().toISOString();
          }

          const date = new Date(createdIso);
          const timeStr = date.toLocaleString('zh-CN', {
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
          }).replace(/\//g, '-');

          return {
            id: String(row.id ?? ''),
            type: (row.type as TaskItem['type']) || 'bounty',
            title: String(row.title ?? ''),
            domain: (row.category as TaskItem['domain']) || '家装',
            desc: String(row.content ?? ''),
            rewardValue: String(row.reward ?? '0'),
            displayTime: timeStr,
            createdAt: createdIso,
            contact: String(row.contact ?? ''),
            user_id: String(row.user_id ?? ''),
            isOwner: user?.id === row.user_id,
            isActive: row.is_active !== false
          };
        });

        // 过滤逻辑：在大厅里，非本人的任务如果过期就不显示
        let filteredByExpiry = formatted.filter(t => {
          const isExpired = new Date(t.createdAt).getTime() + 12 * 60 * 60 * 1000 < now;
          return t.isOwner || !isExpired;
        });

        // 若为注册不满 24 小时的新用户，则屏蔽报酬 > 5000 的任务（非本人）
        if (isNewUser) {
          filteredByExpiry = filteredByExpiry.filter(t => {
            if (t.isOwner) return true;
            const num = parseFloat(String(t.rewardValue).replace(/[^0-9.]/g, '')) || 0;
            return num <= 5000;
          });
        }

        // 过滤掉客户端已标记为"已删除但无法硬删除"的任务（黑名单）
        const visible = filteredByExpiry.filter(t => !hiddenDeletedRef.current.includes(t.id));
        setTasks(visible);

        // 获取当前用户的接单记录（仅用于个人中心的"我的接单"展示）- 并行执行
        if (user) {
          supabase
            .from('task_claims')
            .select('task_id')
            .eq('claimant_id', user.id)
            .then(({ data: claimsData, error: claimsErr }) => {
              if (!claimsErr && claimsData) {
                setClaimedTaskIds(claimsData.map((c: { task_id: string }) => c.task_id));
              }
            });
        }
        if (process.env.NODE_ENV !== 'production') {
          console.log('DEBUG: displayed tasks after filters:', filteredByExpiry.map(t => ({ id: t.id, reward: t.rewardValue, isOwner: t.isOwner })));
        }
      }
    } catch (err) { console.error(err); }
    setTasksLoading(false);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // 载入本地已隐藏（软删除回退为隐藏）的任务 id 黑名单
  useEffect(() => {
    try {
      const stored = localStorage.getItem('hiddenDeletedTaskIds');
      if (stored) {
        const arr = JSON.parse(stored) as string[];
        hiddenDeletedRef.current = arr;
        setHiddenTaskIds(arr);
      }
    } catch (e) { console.warn('读取本地已隐藏任务失败', e); }
  }, []);

  // --- 3. 续期逻辑 ---
  const triggerRenew = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      taskId: id,
      actionType: 'renew',
      title: '续期任务',
      desc: '续期后任务将重新获得 12 小时的展示时间，其他用户可以在大厅看到此任务。'
    });
  };

  const executeRenew = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tasks_reward')
        .update({ created_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      showNotice('任务已成功续期 12 小时');
      fetchTasks();
    } catch (err: unknown) {
      showNotice(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  // 上架逻辑
  const handlePublish = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tasks_reward')
        .update({ is_active: true, created_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      showNotice('任务已上架并重置 12 小时', 'success');
      fetchTasks();
    } catch (err: unknown) {
      showNotice(err instanceof Error ? err.message : '上架失败', 'error');
    }
  };

  // --- 4. 管理操作 (删除/下架) ---
  const triggerConfirm = (id: string, action: 'delete' | 'off') => {
    setConfirmConfig({
      isOpen: true,
      taskId: id,
      actionType: action,
      title: action === 'delete' ? '永久删除任务' : '下架此任务',
      desc: action === 'delete' ? '此操作不可恢复，该任务数据将从服务器彻底移除。' : '下架后，其他用户将无法在大厅看到此任务。'
    });
  };

  const executeManageAction = async () => {
    const { taskId, actionType } = confirmConfig;
    try {
      if (actionType === 'claim') {
        // 接单确认：直接调用 confirmClaim
        await confirmClaim();
      } else if (actionType === 'renew') {
        await executeRenew(taskId);
      } else if (actionType === 'delete') {
        const delClaimsRes = await supabase.from('task_claims').delete().eq('task_id', taskId);
        if (delClaimsRes.error) {
          showNotice('删除关联接单记录失败: ' + delClaimsRes.error.message, 'error');
        }

        const delTaskRes = await supabase.from('tasks_reward').delete().eq('id', taskId);
        if (delTaskRes.error) {
          showNotice('删除任务失败: ' + delTaskRes.error.message, 'error');
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          return;
        }

        const delTaskData = (delTaskRes as { data?: unknown }).data;
        if (!delTaskData || (Array.isArray(delTaskData) && delTaskData.length === 0)) {
          const { error: softErr } = await supabase.from('tasks_reward').update({ is_active: false }).eq('id', taskId);
          if (softErr) {
            showNotice('无法删除或下架该任务，请联系管理员', 'error');
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            return;
          }
          hiddenDeletedRef.current = [...hiddenDeletedRef.current, taskId];
          try { localStorage.setItem('hiddenDeletedTaskIds', JSON.stringify(hiddenDeletedRef.current)); } catch (e) { /* ignore */ }
          setHiddenTaskIds([...hiddenDeletedRef.current]);
          setTasks(prev => prev.filter(t => t.id !== taskId));
          showNotice('已从视图移除该任务，但数据库未被永久删除（请检查 RLS 或使用服务端删除）。', 'success');
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          return;
        }
        showNotice('任务已永久删除');
      } else {
        const { error } = await supabase.from('tasks_reward').update({ is_active: false }).eq('id', taskId);
        if (error) throw error;
        showNotice('任务已成功下架');
      }
      setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      fetchTasks();
    } catch (err: unknown) {
      showNotice(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  const handleShowContact = (contactStr: string) => {
    const info: { wechat?: string; phone?: string; qr?: string } = {};
    const parts = contactStr.split(' | ');
    parts.forEach(p => {
      if (p.startsWith('微信: ')) info.wechat = p.replace('微信: ', '');
      if (p.startsWith('电话: ')) info.phone = p.replace('电话: ', '');
      if (p.startsWith('QR: ')) info.qr = p.replace('QR: ', '');
    });
    setActiveContact(info);
    setIsContactModalOpen(true);
  };

  // 接单逻辑
  const handleClaim = async (task: TaskItem) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { showNotice('请先登录', 'error'); return; }

      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

      const { count, error: countErr } = await supabase
        .from('task_claims')
        .select('id', { count: 'exact', head: true })
        .eq('claimant_id', user.id)
        .gte('claimed_at', start.toISOString())
        .lt('claimed_at', end.toISOString());

      if (countErr) throw countErr;
      const claimedToday = (count as number) || 0;
      if (claimedToday >= 5) {
        showNotice('您今日接单额度已用完，请明天再来。', 'error');
        return;
      }

      // 设置待接单任务并显示二次确认弹框
      setPendingClaimTask(task);
      setConfirmConfig({
        isOpen: true,
        taskId: task.id,
        actionType: 'claim',
        title: '确认接单',
        desc: '确认接单后将显示发布者的联系方式，请您及时联系。接单后不可撤销。'
      });
    } catch (err: unknown) {
      showNotice(err instanceof Error ? err.message : '接单失败', 'error');
    }
  };

  // 确认接单
  const confirmClaim = async () => {
    if (!pendingClaimTask) return;
    setConfirmingClaim(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { showNotice('请先登录', 'error'); setConfirmingClaim(false); return; }

      const { data: existing, error: existErr } = await supabase
        .from('task_claims')
        .select('id')
        .eq('claimant_id', user.id)
        .eq('task_id', pendingClaimTask.id)
        .limit(1);
      if (existErr) throw existErr;
      if (existing && existing.length > 0) {
        showNotice('您已接过该任务', 'error');
        setPendingClaimTask(null);
        setConfirmingClaim(false);
        return;
      }

      const { error: insertErr } = await supabase.from('task_claims').insert([{ claimant_id: user.id, task_id: pendingClaimTask.id, claimed_at: new Date().toISOString() }]);
      if (insertErr) throw insertErr;

      showNotice('接单成功，请及时与发布者联系', 'success');
      setPendingClaimTask(null);
      setConfirmConfig(prev => ({ ...prev, isOpen: false }));

      // 打开聊天对话框
      if (onOpenChat) {
        onOpenChat({
          taskId: pendingClaimTask.id,
          taskTitle: pendingClaimTask.title,
          otherUserId: pendingClaimTask.user_id,
          otherUserName: '发布者',
          currentUserId: currentUserId
        });
      }

      fetchTasks();
    } catch (err: unknown) {
      showNotice(err instanceof Error ? err.message : '确认接单失败', 'error');
    } finally {
      setConfirmingClaim(false);
    }
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postForm.title?.trim()) { showNotice('请填写标题', 'error'); return; }
    if (!postForm.desc?.trim()) { showNotice('请填写需求描述', 'error'); return; }
    if (!postForm.wechat?.trim() && !postForm.phone?.trim() && !postForm.qrFile) {
      showNotice('请至少提供一种联系方式（微信号 / 手机号 / 二维码）', 'error');
      return;
    }
    setPostSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showNotice('请先登录后再发布需求', 'error');
        setPostSubmitting(false);
        return;
      }

      let qrUrl = '';
      if (postForm.qrFile) {
        const path = `tasks/${user.id}/${Date.now()}_qr`;
        const { error: uploadError } = await supabase.storage.from('task-attachments').upload(path, postForm.qrFile);
        if (uploadError) {
          console.warn('二维码上传失败，将仅使用微信号/手机号', uploadError);
        } else {
          qrUrl = supabase.storage.from('task-attachments').getPublicUrl(path).data.publicUrl;
        }
      }

      const contactStr = [`微信: ${postForm.wechat || ''}`, `电话: ${postForm.phone || ''}`, qrUrl ? `QR: ${qrUrl}` : ''].filter(s => !s.endsWith(': ')).join(' | ');

      const { error } = await supabase.from('tasks_reward').insert([{
        user_id: user.id,
        title: postForm.title.trim(),
        type: postTab,
        category: postForm.domain,
        content: postForm.desc.trim(),
        reward: postForm.reward.trim() || '0',
        contact: contactStr,
        is_active: true,
        created_at: new Date().toISOString()
      }]);

      if (error) throw error;
      showNotice('任务发布成功');
      setIsPostModalOpen(false);
      setPostForm({ title: '', domain: '家装', reward: '', desc: '', wechat: '', phone: '', qrFile: null, qrPreview: '' });
      fetchTasks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const detail = err && typeof err === 'object' && 'details' in err ? String((err as { details: unknown }).details) : '';
      showNotice(detail ? `${msg}（${detail}）` : msg, 'error');
    } finally {
      setPostSubmitting(false);
    }
  };

  const filteredTasks = tasks.filter(t => {
    const typeMatch = filterType === 'all' || (filterType === 'mine' ? !!t.isOwner : t.type === filterType);
    const domainMatch = filterDomain === 'all' || t.domain === filterDomain;
    return typeMatch && domainMatch;
  });

  let displayedTasks = filteredTasks;
  if (filterType === 'mine') {
    if (personalTab === 'posted') {
      displayedTasks = tasks.filter(t => t.isOwner && (filterDomain === 'all' || t.domain === filterDomain));
    } else {
      displayedTasks = tasks.filter(t => claimedTaskIds.includes(t.id) && (filterDomain === 'all' || t.domain === filterDomain));
    }
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 pb-20 pt-8 relative">

      {/* Toast 提示 */}
      {toast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4 duration-300">
          <div className={`px-6 py-3 rounded-full border shadow-2xl backdrop-blur-md flex items-center gap-3 ${toast.type === 'success' ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'bg-red-500/20 border-red-500/50 text-red-400'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}
            <span className="text-sm font-bold">{toast.msg}</span>
          </div>
        </div>
      )}

        {/* 管理操作确认弹窗 */}
      {confirmConfig.isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1e293b] w-full max-w-[360px] rounded-3xl border border-slate-700 shadow-2xl p-8 text-center animate-in zoom-in duration-300">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 ${
              confirmConfig.actionType === 'delete' ? 'bg-red-500/10 text-red-500' :
              'bg-orange-500/10 text-orange-500'
            }`}>
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{confirmConfig.title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">{confirmConfig.desc}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                  // 如果是接单确认取消，同时清除待接单任务
                  if (confirmConfig.actionType === 'claim') {
                    setPendingClaimTask(null);
                  }
                }} 
                className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
              >取消</button>
              <button onClick={executeManageAction} className={`flex-1 py-3 rounded-xl text-white font-bold transition-transform active:scale-95 ${
                confirmConfig.actionType === 'delete' ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-900/20' :
                'bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-900/20'
              }`}>确定执行</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center mb-10">
          <div><h1 className="text-3xl font-bold text-white tracking-tight">碳硅合创·任务大厅</h1><p className="text-slate-400 text-sm mt-1">发现 AI 时代的协作与合伙机会</p></div>
          <button onClick={() => { setPostTab('bounty'); setIsPostModalOpen(true); }} className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 transition-all transform hover:scale-105"><Plus size={20} /> 发布需求</button>
        </div>

        {/* 筛选栏 */}
        <div className="bg-[#1e293b]/50 backdrop-blur rounded-2xl p-4 border border-slate-800 flex justify-between items-center mb-10">
          <div className="flex gap-2 bg-[#0f172a] p-1.5 rounded-xl border border-slate-800">
            {['all', 'bounty', 'team', 'mine'].map(id => (
              <button key={id} onClick={() => setFilterType(id as typeof filterType)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${filterType === id ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400'}`}>
                {id === 'all' ? '全部' : id === 'bounty' ? '💰 悬赏' : id === 'team' ? '🤝 组队' : '个人中心'}
              </button>
            ))}
          </div>
          <div className="flex gap-6 text-sm">
            {['all', '家装', '农业', '能源', '职场', '健康', '宠物'].map(d => (
              <button key={d} onClick={() => setFilterDomain(d as typeof filterDomain)} className={`font-medium transition-colors ${filterDomain === d ? 'text-orange-500' : 'text-slate-500'}`}>{d === 'all' ? '全部领域' : d}</button>
            ))}
          </div>
        </div>

        {/* 个人中心子标签 */}
        {filterType === 'mine' && (
          <div className="mb-6 flex gap-3">
            <button onClick={() => setPersonalTab('posted')} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${personalTab === 'posted' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>我发布的</button>
            <button onClick={() => setPersonalTab('claimed')} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${personalTab === 'claimed' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>我的接单</button>
          </div>
        )}

        {/* 任务列表 */}
        {tasksLoading ? (
          <div className="text-center py-20 text-slate-500">同步星际数据中...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {displayedTasks.map(task => {
              const timeLeft = calculateTimeLeft(task.createdAt);
              const isExpired = timeLeft === '已过期';
              const isInactive = task.isActive === false;

              return (
                <div 
                  key={task.id} 
                  className={`bg-[#1e293b] rounded-3xl p-6 border transition-all flex flex-col shadow-xl cursor-pointer ${isExpired ? 'border-red-500/20 opacity-80' : isInactive ? 'border-slate-700/30 opacity-60' : 'border-slate-800 hover:border-orange-500/30 hover:shadow-orange-500/10'}`}
                  onClick={() => {
                    setSelectedTask(task);
                    setIsDetailModalOpen(true);
                  }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded border self-start ${task.type === 'bounty' ? 'text-yellow-500 border-yellow-500/20 bg-yellow-500/5' : 'text-orange-500 border-orange-500/20 bg-orange-500/5'}`}>{task.type === 'bounty' ? '💰 悬赏急单' : '🤝 组队合伙'}</span>
                      {isExpired && <span className="text-[10px] text-red-500 font-bold bg-red-500/10 px-2 py-0.5 rounded">● 任务已过期（大厅不可见）</span>}
                      {isInactive && <span className="text-[10px] text-slate-400 font-bold bg-slate-700/10 px-2 py-0.5 rounded">● 未上架</span>}
                    </div>
                    <div className="text-right text-2xl font-black text-orange-400">{task.type === 'bounty' ? `¥${task.rewardValue}` : task.rewardValue}</div>
                  </div>
                  <h3 
                    className="text-xl font-bold text-white mb-3 cursor-pointer hover:text-orange-400 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTask(task);
                      setIsDetailModalOpen(true);
                    }}
                  >
                    {task.title}
                  </h3>
                  <div 
                    className="text-slate-300 text-sm leading-relaxed mb-6 line-clamp-3 cursor-pointer hover:text-slate-200 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTask(task);
                      setIsDetailModalOpen(true);
                    }}
                  >
                    {task.desc.split('\n').map((line, idx) => (
                      <p key={idx} className="mb-2 last:mb-0">{line || '\u00A0'}</p>
                    ))}
                  </div>
                  <div className="mt-auto pt-4 border-t border-slate-800 flex justify-between items-center">
                    <div className="flex gap-4 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1"><Home size={12}/> {task.domain}</span>
                      <span className={`flex items-center gap-1 font-bold ${isExpired ? 'text-red-500' : 'text-orange-400'}`}><Clock size={12}/> {timeLeft}</span>
                    </div>

                    <div className="flex items-center gap-4">
                      {task.isOwner ? (
                        <div className="flex gap-3">
                          {!task.isActive ? (
                            <button onClick={() => handlePublish(task.id)} className="text-green-500 text-xs font-bold hover:bg-green-500/10 p-2 rounded-lg flex items-center gap-1 border border-green-500/30 transition-all">上架</button>
                          ) : isExpired ? (
                            <button onClick={() => triggerRenew(task.id)} className="text-orange-500 text-xs font-bold hover:bg-orange-500/10 p-2 rounded-lg flex items-center gap-1 border border-orange-500/30 transition-all"><RefreshCw size={14} /> 一键续期</button>
                          ) : (
                            <button onClick={() => triggerConfirm(task.id, 'off')} className="text-slate-400 text-xs font-bold hover:text-orange-400 flex items-center gap-1"><EyeOff size={14} /> 下架</button>
                          )}
                          <button onClick={() => triggerConfirm(task.id, 'delete')} className="text-slate-500 text-xs font-bold hover:text-red-500 flex items-center gap-1"><Trash2 size={14} /> 删除</button>
                        </div>
                      ) : (
                        <button disabled={isExpired || isInactive} onClick={() => handleClaim(task)} className={`text-sm font-bold ${isExpired || isInactive ? 'text-slate-600 cursor-not-allowed' : 'text-orange-500 hover:underline'}`}>立即接单</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 联系弹窗 */}
      {isContactModalOpen && activeContact && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#1e293b] w-full max-w-[380px] rounded-3xl border border-slate-700 shadow-2xl p-8 flex flex-col items-center relative">
            <button onClick={() => { setIsContactModalOpen(false); setPendingClaimTask(null); }} className="absolute right-6 top-6 text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
            <h3 className="text-xl font-bold text-white mb-6">接单联系方式</h3>
            <div className="mb-8 p-3 bg-white rounded-2xl">
              {activeContact.qr ? <img src={activeContact.qr} alt="QR" className="w-48 h-48 rounded-lg object-cover" /> : <div className="w-48 h-48 bg-slate-100 flex flex-col items-center justify-center text-slate-400"><MessageCircle size={40}/><span className="text-[10px]">无二维码</span></div>}
            </div>
            <div className="w-full space-y-4">
              {activeContact.wechat && <div className="bg-[#0f172a] p-4 rounded-xl flex items-center gap-3"><MessageCircle size={16} className="text-green-500" /><div className="text-sm text-slate-200">{activeContact.wechat}</div></div>}
              {activeContact.phone && <div className="bg-[#0f172a] p-4 rounded-xl flex items-center gap-3"><Smartphone size={16} className="text-blue-500" /><div className="text-sm text-slate-200">{activeContact.phone}</div></div>}
            </div>
            <div className="w-full mt-6">
              <button onClick={() => { setIsContactModalOpen(false); setPendingClaimTask(null); }} className="w-full py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors">关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* 发布弹窗 */}
      {isPostModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#1e293b] w-full max-w-[540px] rounded-[2.5rem] border border-slate-700/50 shadow-2xl overflow-hidden">
            <div className="flex bg-[#161e2e] relative">
              <button type="button" onClick={() => setPostTab('bounty')} className={`flex-1 py-5 text-sm font-bold transition-all ${postTab === 'bounty' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-slate-500 hover:text-slate-300'}`}>💰 发布悬赏</button>
              <button type="button" onClick={() => setPostTab('team')} className={`flex-1 py-5 text-sm font-bold transition-all ${postTab === 'team' ? 'text-cyan-500 border-b-2 border-cyan-500' : 'text-slate-500 hover:text-slate-300'}`}>🤝 发起组队</button>
              <button type="button" onClick={() => setIsPostModalOpen(false)} className="absolute right-6 top-5 text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handlePostSubmit} className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">任务标题</label>
                <input className="w-full bg-[#0f172a] border border-slate-700/50 rounded-2xl p-4 outline-none focus:border-orange-500/50 transition-all text-slate-200" placeholder="例如：开发一个自动脚本" value={postForm.title} onChange={e => setPostForm({...postForm, title: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">所属领域</label>
                  <select className="w-full bg-[#0f172a] border border-slate-700/50 rounded-2xl p-4 text-slate-300 outline-none" value={postForm.domain} onChange={e => setPostForm({...postForm, domain: e.target.value as DomainType})}><option>家装</option><option>农业</option><option>能源</option><option>职场</option><option>健康</option><option>宠物</option></select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">预期报酬</label>
                  <input className="w-full bg-[#0f172a] border border-slate-700/50 rounded-2xl p-4 outline-none text-slate-200" placeholder="金额或合作模式" value={postForm.reward} onChange={e => setPostForm({...postForm, reward: e.target.value})} required />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">联系方式 (三选一必填)</label>
                <div className="grid grid-cols-3 gap-3 bg-[#161e2e]/50 p-4 rounded-2xl border border-slate-800/50">
                  <input className="bg-[#0f172a] p-3 text-xs rounded-xl border border-slate-800/50 outline-none" placeholder="微信号" value={postForm.wechat} onChange={e => setPostForm({...postForm, wechat: e.target.value})} />
                  <input className="bg-[#0f172a] p-3 text-xs rounded-xl border border-slate-800/50 outline-none" placeholder="手机号" value={postForm.phone} onChange={e => setPostForm({...postForm, phone: e.target.value})} />
                  <div onClick={() => fileInputRef.current?.click()} className="h-[42px] bg-[#0f172a] border border-dashed border-slate-700 rounded-xl flex items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors">{postForm.qrPreview ? <img src={postForm.qrPreview} alt="预览" className="h-full w-full object-cover rounded-xl" /> : <Upload size={14} className="text-slate-600"/>}</div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) setPostForm({...postForm, qrFile: f, qrPreview: URL.createObjectURL(f)}); }} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">需求描述</label>
                <textarea className="w-full bg-[#0f172a] border border-slate-700/50 rounded-2xl p-4 h-32 resize-none outline-none text-slate-200" placeholder="详细描述您的需求..." value={postForm.desc} onChange={e => setPostForm({...postForm, desc: e.target.value})} required />
              </div>
              <button type="submit" disabled={postSubmitting} className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all active:scale-95 ${postTab === 'bounty' ? 'bg-orange-500 hover:bg-orange-400' : 'bg-cyan-600 hover:bg-cyan-500'} text-white disabled:opacity-60`}>{postSubmitting ? '同步星际数据中...' : '提交需求'}</button>
            </form>
          </div>
        </div>
      )}

      {/* 任务详情弹窗 */}
      {isDetailModalOpen && selectedTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#1e293b] w-full max-w-3xl max-h-[90vh] rounded-3xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col">
            {/* 头部 */}
            <div className="bg-[#161e2e] border-b border-slate-700/50 p-6 flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-xs px-3 py-1 rounded-full border font-medium ${selectedTask.type === 'bounty' ? 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10' : 'text-orange-500 border-orange-500/30 bg-orange-500/10'}`}>
                    {selectedTask.type === 'bounty' ? '💰 悬赏急单' : '🤝 组队合伙'}
                  </span>
                  <span className="text-xs px-3 py-1 rounded-full bg-slate-700/50 text-slate-300 border border-slate-600">
                    <Home size={12} className="inline mr-1" />
                    {selectedTask.domain}
                  </span>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${calculateTimeLeft(selectedTask.createdAt) === '已过期' ? 'text-red-500 bg-red-500/10 border border-red-500/30' : 'text-orange-400 bg-orange-500/10 border border-orange-500/30'}`}>
                    <Clock size={12} className="inline mr-1" />
                    {calculateTimeLeft(selectedTask.createdAt)}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">{selectedTask.title}</h2>
                <div className="text-3xl font-black text-orange-400">
                  {selectedTask.type === 'bounty' ? `¥${selectedTask.rewardValue}` : selectedTask.rewardValue}
                </div>
              </div>
              <button
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setSelectedTask(null);
                }}
                className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-slate-700/50 rounded-lg"
              >
                <X size={24} />
              </button>
            </div>

            {/* 内容区域 - 可滚动 */}
            <div className="flex-1 overflow-y-auto p-8">
              {/* 需求描述 */}
              <div className="mb-8">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                  需求描述
                </h3>
                <div className="bg-[#0f172a] rounded-2xl p-6 border border-slate-700/50">
                  <div className="prose prose-invert prose-slate max-w-none">
                    {selectedTask.desc.split('\n').map((paragraph, idx) => {
                      const trimmed = paragraph.trim();
                      if (!trimmed) {
                        return <div key={idx} className="h-4" />;
                      }
                      // 检测是否是列表项（以 -、*、•、数字开头）
                      if (/^[-*•]\s/.test(trimmed) || /^\d+[\.、]\s/.test(trimmed)) {
                        return (
                          <div key={idx} className="flex items-start gap-3 mb-3">
                            <span className="text-orange-400 mt-1.5 shrink-0">•</span>
                            <p className="text-slate-200 text-base leading-relaxed flex-1">{trimmed.replace(/^[-*•]\s/, '').replace(/^\d+[\.、]\s/, '')}</p>
                          </div>
                        );
                      }
                      return (
                        <p key={idx} className="text-slate-200 text-base leading-relaxed mb-4 last:mb-0 whitespace-pre-wrap">
                          {trimmed}
                        </p>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 任务信息 */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-[#0f172a] rounded-xl p-4 border border-slate-700/50">
                  <div className="text-xs text-slate-500 mb-1">发布时间</div>
                  <div className="text-slate-200 font-medium">{selectedTask.displayTime}</div>
                </div>
                <div className="bg-[#0f172a] rounded-xl p-4 border border-slate-700/50">
                  <div className="text-xs text-slate-500 mb-1">剩余时间</div>
                  <div className={`font-medium ${calculateTimeLeft(selectedTask.createdAt) === '已过期' ? 'text-red-400' : 'text-orange-400'}`}>
                    {calculateTimeLeft(selectedTask.createdAt)}
                  </div>
                </div>
              </div>
            </div>

            {/* 底部操作栏 */}
            <div className="bg-[#161e2e] border-t border-slate-700/50 p-6 flex items-center justify-between">
              <div className="text-sm text-slate-400">
                {selectedTask.isOwner ? '这是您发布的任务' : '点击下方按钮接单'}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setSelectedTask(null);
                  }}
                  className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
                >
                  关闭
                </button>
                {selectedTask.isOwner ? (
                  <div className="flex gap-2">
                    {!selectedTask.isActive ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsDetailModalOpen(false);
                          handlePublish(selectedTask.id);
                        }}
                        className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium transition-colors"
                      >
                        上架
                      </button>
                    ) : calculateTimeLeft(selectedTask.createdAt) === '已过期' ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsDetailModalOpen(false);
                          triggerRenew(selectedTask.id);
                        }}
                        className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                      >
                        <RefreshCw size={16} />
                        续期
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsDetailModalOpen(false);
                          triggerConfirm(selectedTask.id, 'off');
                        }}
                        className="px-6 py-2.5 bg-slate-600 hover:bg-slate-500 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                      >
                        <EyeOff size={16} />
                        下架
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDetailModalOpen(false);
                        triggerConfirm(selectedTask.id, 'delete');
                      }}
                      className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                    >
                      <Trash2 size={16} />
                      删除
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDetailModalOpen(false);
                      handleClaim(selectedTask);
                    }}
                    disabled={calculateTimeLeft(selectedTask.createdAt) === '已过期' || selectedTask.isActive === false}
                    className={`px-6 py-2.5 rounded-xl font-medium transition-colors ${
                      calculateTimeLeft(selectedTask.createdAt) === '已过期' || selectedTask.isActive === false
                        ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                        : 'bg-orange-500 hover:bg-orange-600 text-white'
                    }`}
                  >
                    立即接单
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
