-- 为 tasks_reward 和 arenas 表添加审核提醒时间戳字段
-- 用于10分钟未审核时重发通知的追踪

-- 1. 任务表：添加 reminder_sent_at 字段
ALTER TABLE tasks_reward ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- 2. 竞技场表：添加 reminder_sent_at 字段
ALTER TABLE arenas ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- 3. 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_tasks_reward_reminder ON tasks_reward(reminder_sent_at) WHERE is_approved = false;
CREATE INDEX IF NOT EXISTS idx_arenas_reminder ON arenas(reminder_sent_at) WHERE is_approved = false;
