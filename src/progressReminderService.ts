import { supabase } from './supabaseClient';

export interface ProgressReminder {
  id?: number;
  group_id: number;
  task_id: string;
  reminder_type: '24h_active' | '3_days' | '7_days' | '14_days';
  scheduled_at: string;
  sent_at?: string;
  status: 'pending' | 'sent' | 'failed';
  created_at?: string;
  updated_at?: string;
}

export const REMINDER_MESSAGES = {
  '24h_active': `🔔 温馨提示：任务已接单24小时

💡 提醒建议：
• 请确认需求细节是否已充分沟通
• 如有问题请及时在群内提出
• 保持沟通顺畅，共同完成任务`,
  
  '3_days': `📊 进度检查：任务已进行3天

🎯 下一步建议：
• 更新当前进度状态
• 分享已完成的工作成果
• 讨论遇到的任何问题`,
  
  '7_days': `⚡ 进度提醒：任务已进行7天

📌 重要提示：
• 请确认任务是否按计划进行
• 及时反馈遇到的困难
• 保持定期沟通`,
  
  '14_days': `🎉 任务进度：已进行14天

✨ 完成建议：
• 准备验收材料
• 确认所有需求已满足
• 协调最终交付时间`
};

/**
 * 创建进度提醒记录
 */
export async function createProgressReminder(
  groupId: number,
  taskId: string,
  reminderType: ProgressReminder['reminder_type'],
  scheduledAt: string
): Promise<ProgressReminder | null> {
  try {
    const { data, error } = await supabase
      .from('progress_reminders')
      .insert([{
        group_id: groupId,
        task_id: taskId,
        reminder_type: reminderType,
        scheduled_at: scheduledAt,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) {
      console.error('创建进度提醒失败:', error);
      return null;
    }

    return data as ProgressReminder;
  } catch (error) {
    console.error('创建进度提醒时出错:', error);
    return null;
  }
}

/**
 * 批量创建所有进度提醒
 */
export async function createAllProgressReminders(
  groupId: number,
  taskId: string
): Promise<void> {
  const now = new Date();
  const reminders = [
    {
      type: '24h_active' as const,
      scheduledAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    },
    {
      type: '3_days' as const,
      scheduledAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      type: '7_days' as const,
      scheduledAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      type: '14_days' as const,
      scheduledAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  for (const reminder of reminders) {
    await createProgressReminder(groupId, taskId, reminder.type, reminder.scheduledAt);
  }
}

/**
 * 发送待处理的进度提醒
 */
export async function sendPendingReminders(): Promise<number> {
  try {
    const { data: pendingReminders, error } = await supabase
      .from('progress_reminders')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true });

    if (error || !pendingReminders) {
      console.error('获取待发送提醒失败:', error);
      return 0;
    }

    let sentCount = 0;

    for (const reminder of pendingReminders) {
      try {
        const message = REMINDER_MESSAGES[reminder.reminder_type as keyof typeof REMINDER_MESSAGES];
        
        await supabase
          .from('group_messages')
          .insert([{
            group_id: reminder.group_id,
            sender_id: 'system-bot',
            sender_nickname: '任务助手',
            content: message,
            message_type: 'status',
            is_bot: true,
            is_read: false
          }]);

        await supabase
          .from('progress_reminders')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', reminder.id);

        sentCount++;
      } catch (error) {
        console.error(`发送提醒失败 (ID: ${reminder.id}):`, error);
        
        await supabase
          .from('progress_reminders')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', reminder.id);
      }
    }

    return sentCount;
  } catch (error) {
    console.error('发送进度提醒时出错:', error);
    return 0;
  }
}

/**
 * 获取任务的进度提醒记录
 */
export async function getTaskReminders(taskId: string): Promise<ProgressReminder[]> {
  try {
    const { data, error } = await supabase
      .from('progress_reminders')
      .select('*')
      .eq('task_id', taskId)
      .order('scheduled_at', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data as ProgressReminder[];
  } catch (error) {
    console.error('获取任务提醒失败:', error);
    return [];
  }
}
