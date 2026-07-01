import { supabase } from './supabaseClient';

/**
 * 检查所有待审核超过10分钟的任务和竞技场，
 * 向审核管理员发送提醒通知。
 * 每个项目只发送一次提醒（通过 reminder_sent_at 字段标记）。
 */
export async function sendReviewReminders(): Promise<{ taskCount: number; arenaCount: number }> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  let taskCount = 0;
  let arenaCount = 0;

  try {
    // ===== 1. 检查未审核的任务 =====
    const { data: pendingTasks, error: taskError } = await supabase
      .from('tasks_reward')
      .select('id, title, created_at')
      .eq('is_approved', false)
      .is('reminder_sent_at', null)
      .lte('created_at', tenMinutesAgo);

    if (taskError) {
      console.error('查询待审核任务失败:', taskError);
    } else if (pendingTasks && pendingTasks.length > 0) {
      // 获取所有审核管理员
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_arena_admin', true);

      if (admins && admins.length > 0) {
        for (const task of pendingTasks) {
          const notifications = admins.map(admin => ({
            user_id: admin.id,
            type: 'task_pending_reminder',
            title: '任务审核提醒',
            content: `任务"${task.title}"发布已超过10分钟，仍未审核，请及时处理`,
            is_read: false,
          }));

          await supabase.from('notifications').insert(notifications);

          // 标记已发送提醒
          await supabase
            .from('tasks_reward')
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq('id', task.id);

          taskCount++;
        }
      }
    }

    // ===== 2. 检查未审核的竞技场 =====
    const { data: pendingArenas, error: arenaError } = await supabase
      .from('arenas')
      .select('id, title, created_at')
      .eq('is_approved', false)
      .is('reminder_sent_at', null)
      .lte('created_at', tenMinutesAgo);

    if (arenaError) {
      console.error('查询待审核竞技场失败:', arenaError);
    } else if (pendingArenas && pendingArenas.length > 0) {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_arena_admin', true);

      if (admins && admins.length > 0) {
        for (const arena of pendingArenas) {
          const notifications = admins.map(admin => ({
            user_id: admin.id,
            type: 'arena_pending_reminder',
            title: '竞技场审核提醒',
            content: `竞技场"${arena.title}"发布已超过10分钟，仍未审核，请及时处理`,
            is_read: false,
          }));

          await supabase.from('notifications').insert(notifications);

          // 标记已发送提醒
          await supabase
            .from('arenas')
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq('id', arena.id);

          arenaCount++;
        }
      }
    }
  } catch (err) {
    console.error('发送审核提醒失败:', err);
  }

  if (taskCount > 0 || arenaCount > 0) {
    console.log(`审核提醒已发送：${taskCount}个任务，${arenaCount}个竞技场`);
  }

  return { taskCount, arenaCount };
}
