-- 为 tasks_reward 表添加审核管理员审核策略
-- 只有审核管理员可以更新 is_approved 字段

-- 1. 添加 is_approved 字段（如果不存在）
ALTER TABLE tasks_reward ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

-- 2. 添加审核相关字段
ALTER TABLE tasks_reward ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE tasks_reward ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_tasks_reward_is_approved ON tasks_reward(is_approved);

-- 4. 添加审核管理员更新策略（仅允许更新 is_approved 相关字段）
-- 注意：RLS 必须先启用才能创建策略
ALTER TABLE tasks_reward ENABLE ROW LEVEL SECURITY;

-- 删除已有的策略（如果存在）
DROP POLICY IF EXISTS "审核管理员可以更新 is_approved 字段" ON tasks_reward;

-- 创建新策略：允许审核管理员更新 is_approved 相关字段
CREATE POLICY "审核管理员可以更新 is_approved 字段"
ON tasks_reward
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.is_arena_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.is_arena_admin = true
  )
);

-- 删除已有的选择策略（如果存在）
DROP POLICY IF EXISTS "允许所有人查看已审核通过的任务" ON tasks_reward;
DROP POLICY IF EXISTS "允许所有人查看自己发布的任务" ON tasks_reward;

-- 创建查看策略
CREATE POLICY "允许所有人查看已审核通过的任务"
ON tasks_reward
FOR SELECT
TO authenticated
USING (is_approved = true);

CREATE POLICY "允许所有人查看自己发布的任务"
ON tasks_reward
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
