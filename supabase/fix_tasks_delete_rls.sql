-- 修复 tasks_reward 表的 RLS 策略
-- 允许任务发布者删除自己的任务

-- 1. 删除现有的 DELETE 策略（如果存在）
DROP POLICY IF EXISTS "Users can delete tasks_reward" ON public.tasks_reward;

-- 2. 创建 DELETE 策略：允许用户删除自己发布的任务
CREATE POLICY "Users can delete tasks_reward"
  ON public.tasks_reward
  FOR DELETE
  USING (user_id = auth.uid());

-- 3. 修复 task_claims 表的 RLS 策略
-- 允许任务发布者删除该任务的所有接单记录

-- 删除现有的 DELETE 策略（如果存在）
DROP POLICY IF EXISTS "Users can delete task_claims" ON public.task_claims;

-- 创建 DELETE 策略：允许删除自己发布任务的接单记录
CREATE POLICY "Users can delete task_claims"
  ON public.task_claims
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks_reward
      WHERE tasks_reward.id = task_claims.task_id
      AND tasks_reward.user_id = auth.uid()
    )
  );

-- 4. 确保表已启用 RLS
ALTER TABLE public.tasks_reward ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_claims ENABLE ROW LEVEL SECURITY;
