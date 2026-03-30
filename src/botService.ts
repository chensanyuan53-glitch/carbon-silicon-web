import { supabase } from './supabaseClient';
import { createAllProgressReminders } from './progressReminderService';

// 机器人用户ID常量
export const BOT_USER_ID = 'system-bot';
export const BOT_NICKNAME = '任务助手';

export interface GroupChat {
  id: number;
  task_id: string;
  title: string;
  created_at: string;
}

export interface GroupMember {
  id: number;
  group_id: number;
  user_id: string;
  role: string;
  nickname: string;
  joined_at: string;
}

export interface GroupMessage {
  id: number;
  group_id: number;
  sender_id: string;
  sender_nickname: string;
  content: string;
  message_type: 'text' | 'system' | 'status' | 'file';
  is_bot: boolean;
  is_read: boolean;
  created_at: string;
}

/**
 * 创建群聊并添加成员
 * @param taskId 任务ID
 * @param taskTitle 任务标题
 * @param publisherId 发布者ID
 * @param publisherName 发布者昵称
 * @param acceptorId 接单者ID
 * @param acceptorName 接单者昵称
 * @returns 群聊ID
 */
export async function createGroupChat(
  taskId: string,
  taskTitle: string,
  publisherId: string,
  publisherName: string,
  acceptorId: string,
  acceptorName: string
): Promise<number> {
  try {
    // 1. 创建群聊
    const { data: groupChat, error: groupError } = await supabase
      .from('group_chats')
      .insert([{
        task_id: taskId,
        title: `${taskTitle} - 交流群`
      }])
      .select()
      .single();

    if (groupError) {
      console.error('创建群聊失败:', groupError);
      console.error('错误详情:', JSON.stringify(groupError, null, 2));
      throw new Error('创建群聊失败');
    }

    const groupId = groupChat.id;

    // 2. 添加成员
    const members = [
      { group_id: groupId, user_id: publisherId, role: 'member', nickname: publisherName },
      { group_id: groupId, user_id: acceptorId, role: 'member', nickname: acceptorName },
      { group_id: groupId, user_id: BOT_USER_ID, role: 'bot', nickname: BOT_NICKNAME }
    ];

    const { error: membersError } = await supabase
      .from('group_members')
      .insert(members);

    if (membersError) {
      console.error('添加群成员失败:', membersError);
      throw new Error('添加群成员失败');
    }

    // 3. 发送欢迎消息
    const welcomeMessage = `🎉 群聊已创建！

📋 任务：${taskTitle}
👤 发布者：${publisherName || '用户'}
🛠️ 接单者：${acceptorName || '用户'}

💡 提示：
• 请及时沟通需求细节
• 遇到问题及时反馈
• 任务完成后请确认验收
• 保持友好交流，共同完成`;

    await sendBotMessage(groupId, welcomeMessage, 'system');

    // 4. 创建进度提醒
    try {
      await createAllProgressReminders(groupId, taskId);
    } catch (reminderError) {
      // 进度提醒创建失败不影响群聊创建
      console.error('创建进度提醒失败:', reminderError);
    }

    return groupId;
  } catch (error) {
    console.error('创建群聊时出错:', error);
    throw error;
  }
}

/**
 * 发送机器人消息
 * @param groupId 群聊ID
 * @param content 消息内容
 * @param messageType 消息类型
 */
export async function sendBotMessage(
  groupId: number,
  content: string,
  messageType: 'text' | 'system' | 'status' | 'file' = 'text'
): Promise<void> {
  try {
    const { error } = await supabase
      .from('group_messages')
      .insert([{
        group_id: groupId,
        sender_id: BOT_USER_ID,
        sender_nickname: BOT_NICKNAME,
        content: content,
        message_type: messageType,
        is_bot: true,
        is_read: false
      }]);

    if (error) {
      console.error('发送机器人消息失败:', error);
      throw new Error('发送机器人消息失败');
    }
  } catch (error) {
    console.error('发送机器人消息时出错:', error);
    throw error;
  }
}

/**
 * 获取用户昵称
 * @param userId 用户ID
 * @returns 用户昵称
 */
export async function getUserNickname(userId: string): Promise<string> {
  try {
    // 从 auth metadata 获取昵称
    // 注意：由于 Supabase 客户端限制，这里可能需要从 profiles 表获取
    // 或者从前端传入
    const { data: { user } } = await supabase.auth.getUser();

    if (user?.id === userId) {
      const meta = user.user_metadata || {};
      return meta.nickname || user.email || '用户';
    }

    return '用户';
  } catch (error) {
    console.error('获取用户昵称失败:', error);
    return '用户';
  }
}

/**
 * 检查任务是否已有群聊
 * @param taskId 任务ID
 * @returns 群聊ID，如果没有则返回 null
 */
export async function getExistingGroupChat(taskId: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('group_chats')
      .select('id')
      .eq('task_id', taskId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('检查群聊是否存在失败:', error);
    return null;
  }
}

/**
 * 获取群聊详情
 * @param groupId 群聊ID
 * @returns 群聊信息
 */
export async function getGroupChat(groupId: number): Promise<GroupChat | null> {
  try {
    const { data, error } = await supabase
      .from('group_chats')
      .select('*')
      .eq('id', groupId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as GroupChat;
  } catch (error) {
    console.error('获取群聊详情失败:', error);
    return null;
  }
}

/**
 * 获取群聊成员列表
 * @param groupId 群聊ID
 * @returns 成员列表
 */
export async function getGroupMembers(groupId: number): Promise<GroupMember[]> {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data as GroupMember[];
  } catch (error) {
    console.error('获取群成员列表失败:', error);
    return [];
  }
}
