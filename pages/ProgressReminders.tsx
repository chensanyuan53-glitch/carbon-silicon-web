import React, { useState, useEffect } from 'react';
import { supabase } from '../src/supabaseClient';
import { RefreshCw, CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react';

interface ProgressReminder {
  id: number;
  group_id: number;
  task_id: string;
  reminder_type: string;
  scheduled_at: string;
  sent_at: string | null;
  status: 'pending' | 'sent' | 'failed';
  created_at: string;
  updated_at: string;
}

interface GroupChat {
  id: number;
  task_id: string;
  title: string;
  created_at: string;
}

export const ProgressReminders: React.FC = () => {
  const [reminders, setReminders] = useState<ProgressReminder[]>([]);
  const [groupChats, setGroupChats] = useState<Map<number, GroupChat>>(new Map());
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadReminders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('progress_reminders')
        .select('*')
        .order('scheduled_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setReminders(data || []);

      const groupIds = [...new Set(data?.map(r => r.group_id) || [])];
      if (groupIds.length > 0) {
        const { data: chats } = await supabase
          .from('group_chats')
          .select('*')
          .in('id', groupIds);

        const chatMap = new Map();
        chats?.forEach(chat => chatMap.set(chat.id, chat));
        setGroupChats(chatMap);
      }
    } catch (error) {
      console.error('加载进度提醒失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个提醒吗？')) return;

    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('progress_reminders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setReminders(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('删除提醒失败:', error);
      alert('删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getReminderTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      '24h_active': '24小时活跃提醒',
      '3_days': '3天进度检查',
      '7_days': '7天进度提醒',
      '14_days': '14天完成提醒'
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string; icon: any }> = {
      pending: {
        color: 'bg-yellow-500/20 text-yellow-500',
        label: '待发送',
        icon: Clock
      },
      sent: {
        color: 'bg-green-500/20 text-green-500',
        label: '已发送',
        icon: CheckCircle
      },
      failed: {
        color: 'bg-red-500/20 text-red-500',
        label: '发送失败',
        icon: XCircle
      }
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon size={12} />
        {badge.label}
      </span>
    );
  };

  const stats = {
    pending: reminders.filter(r => r.status === 'pending').length,
    sent: reminders.filter(r => r.status === 'sent').length,
    failed: reminders.filter(r => r.status === 'failed').length
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">进度提醒管理</h1>
          <button
            onClick={loadReminders}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={16} />
            刷新
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-3">
              <Clock className="text-yellow-500" size={24} />
              <div>
                <div className="text-2xl font-bold text-white">{stats.pending}</div>
                <div className="text-sm text-gray-400">待发送</div>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-green-500" size={24} />
              <div>
                <div className="text-2xl font-bold text-white">{stats.sent}</div>
                <div className="text-sm text-gray-400">已发送</div>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-3">
              <XCircle className="text-red-500" size={24} />
              <div>
                <div className="text-2xl font-bold text-white">{stats.failed}</div>
                <div className="text-sm text-gray-400">发送失败</div>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-8">加载中...</div>
        ) : reminders.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
            暂无进度提醒记录
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-white font-medium text-sm">任务</th>
                    <th className="px-4 py-3 text-left text-white font-medium text-sm">提醒类型</th>
                    <th className="px-4 py-3 text-left text-white font-medium text-sm">计划时间</th>
                    <th className="px-4 py-3 text-left text-white font-medium text-sm">状态</th>
                    <th className="px-4 py-3 text-left text-white font-medium text-sm">发送时间</th>
                    <th className="px-4 py-3 text-left text-white font-medium text-sm">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {reminders.map((reminder) => {
                    const chat = groupChats.get(reminder.group_id);
                    return (
                      <tr key={reminder.id} className="border-t border-gray-700 hover:bg-gray-750">
                        <td className="px-4 py-3">
                          <div className="text-gray-300 text-sm font-medium">{chat?.title || '未知任务'}</div>
                          <div className="text-gray-500 text-xs mt-0.5">{reminder.task_id.slice(0, 8)}...</div>
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-sm">
                          {getReminderTypeLabel(reminder.reminder_type)}
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-sm">
                          {formatDate(reminder.scheduled_at)}
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(reminder.status)}
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-sm">
                          {reminder.sent_at ? formatDate(reminder.sent_at) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleDelete(reminder.id)}
                            disabled={deletingId === reminder.id}
                            className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
