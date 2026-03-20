# 在线聊天功能说明

## 功能概述

任务大厅现已集成在线聊天功能，接单者可以与发布者进行实时在线沟通。

## 主要功能

### 1. 接单后自动打开聊天
- 用户在任务大厅点击"立即接单"
- 二次确认接单
- 接单成功后自动打开与发布者的聊天对话框
- 用户可以直接在对话框中发送消息

### 2. 消息通知（铃铛图标）
- 右上角铃铛图标显示未读消息数量
- 点击铃铛图标展开消息列表
- 显示最近的 20 条消息
- 未读消息有橙色圆点标记
- 点击消息可直接打开聊天对话框

### 3. 聊天对话框
- 显示与对方关于某个任务的聊天记录
- 实时接收新消息（使用 Supabase Realtime）
- 自己的消息在右侧（橙色），对方消息在左侧（灰色）
- 显示消息时间
- 自动滚动到最新消息
- 打开聊天对话框时自动标记消息为已读

## 数据库设置

### 执行迁移脚本

在 Supabase 控制台的 SQL Editor 中执行：

```bash
# 在项目根目录运行迁移脚本
node run-migration.mjs supabase/create_messages_table.sql
```

或直接在 Supabase 控制台的 SQL Editor 中执行 `supabase/create_messages_table.sql` 文件的内容。

### 数据表结构

#### messages 表
```sql
CREATE TABLE public.messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id UUID NOT NULL,          -- 发送者ID
  receiver_id UUID NOT NULL,         -- 接收者ID
  task_id TEXT NOT NULL,              -- 关联任务ID
  task_title TEXT,                    -- 任务标题（显示用）
  content TEXT NOT NULL,              -- 消息内容
  is_read BOOLEAN DEFAULT FALSE,       -- 是否已读
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### profiles 视图
- 从 auth.users 创建的视图，包含用户的公开信息
- 用于显示发送者的邮箱等信息

## 使用流程

### 接单者
1. 在任务大厅浏览任务
2. 点击"立即接单"
3. 在确认弹框中点击"确定"
4. 自动打开与发布者的聊天对话框
5. 在对话框中发送消息询问任务详情

### 发布者
1. 接到接单后，右上角铃铛图标显示未读消息
2. 点击铃铛图标查看消息列表
3. 点击消息打开聊天对话框
4. 在对话框中回复接单者

## 技术实现

### Realtime 功能
使用 Supabase Realtime 实现消息实时推送：

```typescript
const channel = supabase
  .channel(`messages:${taskId}:${userId}`)
  .on('postgres_changes', { event: 'INSERT', ... }, (payload) => {
    // 收到新消息
  })
  .subscribe();
```

### RLS 策略
- 用户只能查看自己发送或接收的消息
- 用户只能以发送者身份插入消息
- 用户可以标记接收到的消息为已读

## 组件说明

### ChatDialog
聊天对话框组件
- 位置：`components/ChatDialog.tsx`
- 功能：显示聊天界面，发送和接收消息

### MessageDropdown
消息通知下拉组件
- 位置：`components/MessageDropdown.tsx`
- 功能：显示未读消息数量和消息列表

## 注意事项

1. **首次使用**：需要先在 Supabase 控制台执行 SQL 迁移脚本创建数据表
2. **Realtime 启用**：需要在 Supabase 控制台的 Realtime 设置中启用 `messages` 表
3. **RLS 策略**：确保已正确设置 RLS 策略，否则可能无法查看消息
4. **消息限制**：目前消息列表显示最近 20 条，如需更多可修改 `limit(20)` 参数

## 后续优化建议

1. 添加消息输入字数限制
2. 支持发送图片和文件
3. 添加消息撤回功能
4. 支持离线消息缓存
5. 添加消息已送达/已读回执
6. 支持创建聊天分组
