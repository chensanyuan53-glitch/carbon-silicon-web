# 群聊机器人使用指南

## 功能概述

本项目实现了基于 Supabase 的内部群聊机器人系统，在用户接单时自动创建群聊并协助任务管理。

## 数据库表结构

### 1. group_chats（群聊表）
- `id`: 群聊ID
- `task_id`: 关联的任务ID
- `title`: 群聊标题
- `created_at`: 创建时间

### 2. group_members（群成员表）
- `id`: 成员ID
- `group_id`: 群聊ID
- `user_id`: 用户ID
- `role`: 角色（member | bot）
- `nickname`: 昵称
- `joined_at`: 加入时间

### 3. group_messages（群消息表）
- `id`: 消息ID
- `group_id`: 群聊ID
- `sender_id`: 发送者ID
- `sender_nickname`: 发送者昵称
- `content`: 消息内容
- `message_type`: 消息类型（text | system | status | file）
- `is_bot`: 是否为机器人消息
- `is_read`: 是否已读
- `created_at`: 创建时间

## 使用步骤

### 1. 执行数据库迁移

在 Supabase 数据库中执行以下 SQL 文件：

```bash
# 方式1：使用 Supabase CLI
supabase db push

# 方式2：在 Supabase Dashboard 中手动执行 SQL
# 打开 SQL Editor，执行 supabase/create_group_chat_tables.sql 的内容
```

### 2. 机器人自动触发

当用户在任务市场接单时，系统会自动：

1. **检查群聊是否存在** - 如果任务已有群聊，跳过创建
2. **创建群聊** - 为任务创建专用交流群
3. **添加成员** - 将发布者、接单者和机器人添加到群
4. **发送欢迎消息** - 机器人自动发送任务信息和提示

### 3. 欢迎消息示例

```
🎉 群聊已创建！

📋 任务：任务标题
👤 发布者：张三
🛠️ 接单者：李四

💡 提示：
• 请及时沟通需求细节
• 遇到问题及时反馈
• 任务完成后请确认验收
• 保持友好交流，共同完成
```

## 机器人服务 API

### 创建群聊

```typescript
import { createGroupChat } from '../src/botService';

const groupId = await createGroupChat(
  taskId,           // 任务ID
  taskTitle,        // 任务标题
  publisherId,      // 发布者ID
  publisherName,    // 发布者昵称
  acceptorId,       // 接单者ID
  acceptorName      // 接单者昵称
);
```

### 发送机器人消息

```typescript
import { sendBotMessage } from '../src/botService';

await sendBotMessage(
  groupId,           // 群聊ID
  '消息内容',        // 消息内容
  'system'           // 消息类型（可选）
);
```

### 检查群聊是否存在

```typescript
import { getExistingGroupChat } from '../src/botService';

const groupId = await getExistingGroupChat(taskId);
if (groupId) {
  console.log('群聊已存在');
} else {
  console.log('群聊不存在');
}
```

## 群聊对话框组件

在需要显示群聊的地方使用：

```typescript
import { GroupChatDialog } from '../components/GroupChatDialog';

<GroupChatDialog
  isOpen={showGroupChat}
  onClose={() => setShowGroupChat(false)}
  taskId={taskId}
  currentUserId={userId}
/>
```

## 消息类型

| 类型 | 说明 | 用途 |
|------|------|------|
| text | 普通文本 | 用户发送的普通消息 |
| system | 系统消息 | 机器人的欢迎消息、提示等 |
| status | 状态消息 | 任务状态变化通知 |
| file | 文件消息 | 文件上传通知 |

## 扩展功能建议

### 1. 进度提醒
定时询问任务进度，提醒用户更新状态。

### 2. 截止提醒
在任务到期前 24 小时发送提醒。

### 3. 文件管理
检测群内文件上传，提醒审核。

### 4. 智能回复
根据关键词自动回复常见问题。

### 5. 完成确认
任务完成后引导双方确认和评价。

## 注意事项

1. **机器人ID常量**: `BOT_USER_ID = 'system-bot'`
2. **机器人昵称**: `BOT_NICKNAME = '任务助手'`
3. **群聊创建失败不影响接单**: 即使群聊创建失败，接单流程仍会继续
4. **消息实时同步**: 使用 Supabase Realtime 实现消息实时推送
5. **权限控制**: RLS 策略确保用户只能访问自己所在的群聊

## 故障排查

### 问题1：群聊创建失败
- 检查数据库表是否创建成功
- 查看浏览器控制台错误信息

### 问题2：消息不显示
- 检查 RLS 策略是否正确
- 确认用户是否在群成员列表中

### 问题3：机器人消息未发送
- 检查 `BOT_USER_ID` 是否正确
- 查看网络请求是否成功

## 下一步计划

- [ ] 添加群聊列表页面
- [ ] 实现任务状态通知
- [ ] 添加进度提醒功能
- [ ] 实现文件上传和管理
- [ ] 添加争议处理机制
