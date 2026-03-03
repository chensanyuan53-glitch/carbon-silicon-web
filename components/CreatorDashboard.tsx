import React, { useState } from 'react';
import { Download, Award, Trophy, Star } from 'lucide-react';
import type { ArenaSubmission } from '../types/supabase';
import { gradeSubmission, updateArenaStatus } from '../src/api/arena';

interface CreatorDashboardProps {
  arenaId: number;
  submissions: ArenaSubmission[];
  onUpdate: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待评审',
  winner: '已优胜',
  runner_up: 'Runner-up',
  rejected: '未通过',
};

export const CreatorDashboard: React.FC<CreatorDashboardProps> = ({
  arenaId,
  submissions,
  onUpdate,
}) => {
  const [gradingId, setGradingId] = useState<number | null>(null);
  const [score, setScore] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScoreSubmit = async (submissionId: number) => {
    const scoreNum = Number(score);
    if (Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      setError('请输入 0-100 之间的分数');
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      await gradeSubmission(submissionId, scoreNum, 'pending');
      setGradingId(null);
      setScore('');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : '评分失败');
    } finally {
      setProcessing(false);
    }
  };

  const handleSetWinner = async (submissionId: number) => {
    if (!confirm('确定将该投稿设为优胜？此操作会将竞技场状态设为已完成。')) {
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      // 先更新投稿状态为 winner
      await gradeSubmission(submissionId, Number(score) || 100, 'winner');
      // 然后更新竞技场状态为 finished
      await updateArenaStatus(arenaId, 'finished');
      setGradingId(null);
      setScore('');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setProcessing(false);
    }
  };

  const handleSetRunnerUp = async (submissionId: number) => {
    setProcessing(true);
    setError(null);
    try {
      await gradeSubmission(submissionId, Number(score) || 80, 'runner_up');
      setGradingId(null);
      setScore('');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setProcessing(false);
    }
  };

  const formatWorkerId = (id: string) => {
    return `${id.slice(0, 8)}...${id.slice(-4)}`;
  };

  if (submissions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-6">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <Award size={18} /> 投稿管理面板
        </h3>
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-700/50 mb-4">
            <Award size={32} className="text-slate-500" />
          </div>
          <p className="text-slate-400 mb-2">暂无投稿</p>
          <p className="text-slate-500 text-sm">等待参赛者提交方案...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white font-bold flex items-center gap-2">
          <Award size={18} /> 投稿管理面板
        </h3>
        <span className="text-xs text-slate-400">共 {submissions.length} 份投稿</span>
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                投稿人
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                提交时间
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                方案简述
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                附件
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                状态
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((sub) => (
              <tr
                key={sub.id}
                className="border-b border-slate-700/50 hover:bg-slate-900/50 transition-colors"
              >
                <td className="py-4 px-4">
                  <div className="text-sm text-slate-300 font-mono">
                    {formatWorkerId(sub.worker_id)}
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="text-sm text-slate-400">
                    {new Date(sub.created_at).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </td>
                <td className="py-4 px-4 max-w-xs">
                  <div className="text-sm text-slate-200 line-clamp-2">
                    {sub.summary || '—'}
                  </div>
                </td>
                <td className="py-4 px-4">
                  {sub.file_url ? (
                    <a
                      href={sub.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm transition-colors"
                    >
                      <Download size={14} />
                      下载
                    </a>
                  ) : (
                    <span className="text-slate-500 text-sm">—</span>
                  )}
                </td>
                <td className="py-4 px-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      sub.status === 'winner'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : sub.status === 'pending'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-slate-700/50 text-slate-400 border border-slate-600'
                    }`}
                  >
                    {STATUS_LABEL[sub.status] ?? sub.status}
                  </span>
                  {sub.score != null && (
                    <div className="text-xs text-amber-400 mt-1">{sub.score} 分</div>
                  )}
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    {gradingId === sub.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={score}
                          onChange={(e) => setScore(e.target.value)}
                          className="w-16 bg-slate-900 border border-slate-600 text-white px-2 py-1 rounded text-sm focus:outline-none focus:border-amber-500"
                          placeholder="分数"
                        />
                        <button
                          onClick={() => handleScoreSubmit(sub.id)}
                          disabled={processing}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs rounded font-medium transition-colors"
                        >
                          提交
                        </button>
                        <button
                          onClick={() => {
                            setGradingId(null);
                            setScore('');
                          }}
                          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded font-medium transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setGradingId(sub.id);
                            setScore(sub.score?.toString() || '');
                          }}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg font-medium transition-colors flex items-center gap-1"
                        >
                          <Star size={14} />
                          评分
                        </button>
                        <button
                          onClick={() => handleSetRunnerUp(sub.id)}
                          disabled={processing || sub.status === 'runner_up'}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded-lg font-medium transition-colors"
                        >
                          入围
                        </button>
                        <button
                          onClick={() => handleSetWinner(sub.id)}
                          disabled={processing || sub.status === 'winner'}
                          className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white text-xs rounded-lg font-medium transition-all shadow-lg shadow-amber-500/20 disabled:shadow-none flex items-center gap-1"
                        >
                          <Trophy size={14} />
                          {sub.status === 'winner' ? '已优胜' : '优胜'}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
