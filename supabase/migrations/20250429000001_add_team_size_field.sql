-- 为 tasks_reward 表添加组队人数字段
-- 用于组队任务，记录需要的人数上限

-- 添加组队人数字段（可选，悬赏任务可为空）
ALTER TABLE public.tasks_reward
  ADD COLUMN IF NOT EXISTS team_size INTEGER DEFAULT 0;

-- 添加当前队伍人数字段（可选）
ALTER TABLE public.tasks_reward
  ADD COLUMN IF NOT EXISTS current_team_count INTEGER DEFAULT 1;

-- 为已有数据设置默认值（发布者自己算1人）
UPDATE public.tasks_reward
SET team_size = 2
WHERE type = 'team' AND (team_size IS NULL OR team_size = 0);

-- 设置当前队伍人数默认值（只有发布者）
UPDATE public.tasks_reward
SET current_team_count = 1
WHERE current_team_count IS NULL;

-- 添加注释
COMMENT ON COLUMN public.tasks_reward.team_size IS '组队任务需要的人数上限';
COMMENT ON COLUMN public.tasks_reward.current_team_count IS '当前队伍已有人数';
