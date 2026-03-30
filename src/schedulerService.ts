import cron from 'node-cron';
import { sendPendingReminders } from './progressReminderService';

let isRunning = false;
let task: cron.ScheduledTask | null = null;

/**
 * 启动定时任务
 * 每小时检查并发送待处理的进度提醒
 */
export function startScheduler() {
  if (isRunning) {
    console.log('定时任务已在运行中');
    return;
  }

  task = cron.schedule('0 * * * *', async () => {
    console.log('开始检查待发送的进度提醒...');
    
    try {
      const sentCount = await sendPendingReminders();
      console.log(`成功发送 ${sentCount} 条进度提醒`);
    } catch (error) {
      console.error('发送进度提醒时出错:', error);
    }
  });

  isRunning = true;
  console.log('定时任务已启动，每小时检查一次进度提醒');
}

/**
 * 停止定时任务
 */
export function stopScheduler() {
  if (task) {
    task.stop();
    task = null;
  }
  isRunning = false;
  console.log('定时任务已停止');
}

/**
 * 检查定时任务是否运行中
 */
export function isSchedulerRunning(): boolean {
  return isRunning;
}

/**
 * 立即执行一次检查（用于测试）
 */
export async function executeCheckNow(): Promise<number> {
  console.log('手动执行进度提醒检查...');
  
  try {
    const sentCount = await sendPendingReminders();
    console.log(`成功发送 ${sentCount} 条进度提醒`);
    return sentCount;
  } catch (error) {
    console.error('执行检查时出错:', error);
    return 0;
  }
}
