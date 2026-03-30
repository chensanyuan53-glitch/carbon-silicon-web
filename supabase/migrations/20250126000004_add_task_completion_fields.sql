-- 添加任务完成确认相关字段
-- 此迁移为 tasks_reward 表添加完成确认字段
-- 并修改 task_claims 表以支持完成确认流程

-- 1. 为 tasks_reward 表添加完成确认字段
ALTER TABLE public.tasks_reward
ADD COLUMN IF NOT EXISTS confirmed_by_claimant BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS confirmed_by_publisher BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_by_user_id UUID;

-- 2. 启用 task_claims 表的 RLS（如果尚未启用）
ALTER TABLE public.task_claims ENABLE ROW LEVEL SECURITY;

-- 3. 为 task_claims 表添加完成确认字段
ALTER TABLE public.task_claims
ADD COLUMN IF NOT EXISTS claimant_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS publisher_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS claimant_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS publisher_confirmed_at TIMESTAMP WITH TIME ZONE;

-- 4. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_task_claims_claimant_confirmed ON public.task_claims(claimant_confirmed);
CREATE INDEX IF NOT EXISTS idx_task_claims_publisher_confirmed ON public.task_claims(publisher_confirmed);

-- 5. 更新 RLS 策略，允许用户更新确认状态
-- 接单者可以更新自己的确认状态
DROP POLICY IF EXISTS "Claimants can update their claim confirmation" ON public.task_claims;
CREATE POLICY "Claimants can update their claim confirmation"
ON public.task_claims
FOR UPDATE
USING (auth.uid() = claimant_id)
WITH CHECK (auth.uid() = claimant_id);

-- 确保至少有一个 SELECT 策略（如果没有其他策略的话）
DROP POLICY IF EXISTS "Enable read access for all users" ON public.task_claims;
CREATE POLICY "Enable read access for all users"
ON public.task_claims
FOR SELECT
USING (true);

-- 发布者可以更新自己的确认状态（需要通过触发器或应用逻辑）
DROP POLICY IF EXISTS "Publishers can update task completion confirmation" ON public.tasks_reward;
CREATE POLICY "Publishers can update task completion confirmation"
ON public.tasks_reward
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. 创建触发器：当接单者确认完成时，自动更新 tasks_reward 表
CREATE OR REPLACE FUNCTION public.handle_claimant_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果接单者确认完成，更新 tasks_reward 表的确认状态
  IF NEW.claimant_confirmed = TRUE AND OLD.claimant_confirmed = FALSE THEN
    UPDATE public.tasks_reward
    SET
      confirmed_by_claimant = TRUE
    WHERE id = NEW.task_id;
  END IF;

  -- 如果发布者确认完成，更新 tasks_reward 表的确认状态
  IF NEW.publisher_confirmed = TRUE AND OLD.publisher_confirmed = FALSE THEN
    UPDATE public.tasks_reward
    SET
      confirmed_by_publisher = TRUE,
      completed_at = COALESCE(NEW.publisher_confirmed_at, NOW()),
      completed_by_user_id = auth.uid()
    WHERE id = NEW.task_id;
  END IF;

  -- 检查是否双方都已确认
  IF NEW.claimant_confirmed = TRUE AND NEW.publisher_confirmed = TRUE THEN
    -- 更新任务状态为已完成
    UPDATE public.tasks_reward
    SET
      completed = TRUE,
      completed_at = COALESCE(NEW.publisher_confirmed_at, NOW()),
      completed_by_user_id = auth.uid()
    WHERE id = NEW.task_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器
DROP TRIGGER IF EXISTS on_task_claim_completion ON public.task_claims;
CREATE TRIGGER on_task_claim_completion
AFTER UPDATE OF claimant_confirmed, publisher_confirmed ON public.task_claims
FOR EACH ROW
EXECUTE FUNCTION public.handle_claimant_completion();

-- 7. 添加通知支持：当接单者或发布者确认完成时，发送通知
CREATE OR REPLACE FUNCTION public.notify_task_completion()
RETURNS TRIGGER AS $$
DECLARE
  task_record RECORD;
  claim_record RECORD;
  v_publisher_id UUID;
  v_claimant_id UUID;
  task_title TEXT;
BEGIN
  -- 获取任务信息
  SELECT tr.user_id, tr.title INTO task_record
  FROM public.tasks_reward tr
  WHERE tr.id = NEW.task_id;

  -- 获取接单记录信息
  SELECT claimant_id INTO claim_record
  FROM public.task_claims
  WHERE task_id = NEW.task_id
  ORDER BY claimed_at DESC
  LIMIT 1;

  v_publisher_id := task_record.user_id;
  task_title := task_record.title;
  v_claimant_id := claim_record.claimant_id;

  -- 接单者确认完成，通知发布者
  IF NEW.claimant_confirmed = TRUE AND OLD.claimant_confirmed = FALSE THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      content,
      related_link,
      is_read,
      created_at
    ) VALUES (
      v_publisher_id,
      'task_completion',
      '任务完成确认请求',
      '接单者已确认完成任务「' || task_title || '」，请查看并确认。',
      '/tasks#' || NEW.task_id::TEXT,
      false,
      NOW()
    );
  END IF;

  -- 发布者确认完成，通知接单者
  IF NEW.publisher_confirmed = TRUE AND OLD.publisher_confirmed = FALSE THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      content,
      related_link,
      is_read,
      created_at
    ) VALUES (
      v_claimant_id,
      'task_completed',
      '任务已完成',
      '发布者已确认完成任务「' || task_title || '」，任务已完成！',
      '/tasks#' || NEW.task_id::TEXT,
      false,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建通知触发器
DROP TRIGGER IF EXISTS notify_task_completion_trigger ON public.task_claims;
CREATE TRIGGER notify_task_completion_trigger
AFTER UPDATE OF claimant_confirmed, publisher_confirmed ON public.task_claims
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_completion();

-- 8. 确保有必要的权限
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON TABLE public.task_claims TO authenticated;
GRANT ALL ON TABLE public.tasks_reward TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_claimant_completion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_task_completion() TO authenticated;

COMMENT ON TABLE public.tasks_reward IS '任务表，包含完成确认字段';
COMMENT ON COLUMN public.tasks_reward.confirmed_by_claimant IS '接单者是否确认完成';
COMMENT ON COLUMN public.tasks_reward.confirmed_by_publisher IS '发布者是否确认完成';
COMMENT ON COLUMN public.tasks_reward.completed_at IS '任务完成时间';
COMMENT ON COLUMN public.tasks_reward.completed_by_user_id IS '最后确认完成的用户ID';

COMMENT ON TABLE public.task_claims IS '任务接单表，包含完成确认字段';
COMMENT ON COLUMN public.task_claims.claimant_confirmed IS '接单者是否确认完成';
COMMENT ON COLUMN public.task_claims.publisher_confirmed IS '发布者是否确认完成';
COMMENT ON COLUMN public.task_claims.claimant_confirmed_at IS '接单者确认时间';
COMMENT ON COLUMN public.task_claims.publisher_confirmed_at IS '发布者确认时间';
