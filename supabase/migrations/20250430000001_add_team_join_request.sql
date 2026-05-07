-- 为 task_claims 表添加组队审核相关字段
-- 支持组队任务的加入申请和审核流程

-- 添加申请状态字段：pending（待审核）、approved（已同意）、rejected（已拒绝）
ALTER TABLE public.task_claims
  ADD COLUMN IF NOT EXISTS join_status VARCHAR(20) DEFAULT 'approved';

-- 添加申请时间字段
ALTER TABLE public.task_claims
  ADD COLUMN IF NOT EXISTS join_request_at TIMESTAMPTZ;

-- 添加审核时间字段
ALTER TABLE public.task_claims
  ADD COLUMN IF NOT EXISTS join_reviewed_at TIMESTAMPTZ;

-- 添加审核者ID字段（谁同意了申请）
ALTER TABLE public.task_claims
  ADD COLUMN IF NOT EXISTS reviewed_by UUID;

-- 添加申请者昵称字段（用于通知显示）
ALTER TABLE public.task_claims
  ADD COLUMN IF NOT EXISTS claimant_nickname TEXT;

-- 为已有记录设置默认状态
UPDATE public.task_claims
SET join_status = 'approved'
WHERE join_status IS NULL;

-- 添加注释
COMMENT ON COLUMN public.task_claims.join_status IS '组队申请状态：pending（待审核）、approved（已同意）、rejected（已拒绝）';
COMMENT ON COLUMN public.task_claims.join_request_at IS '组队申请时间';
COMMENT ON COLUMN public.task_claims.join_reviewed_at IS '组队审核时间';
COMMENT ON COLUMN public.task_claims.reviewed_by IS '审核者ID';
COMMENT ON COLUMN public.task_claims.claimant_nickname IS '申请者昵称（用于通知）';

-- 更新触发器函数：当组队任务有新的approved申请时，增加current_team_count
CREATE OR REPLACE FUNCTION public.update_team_count_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- 只处理组队任务且状态变为approved的情况
  IF NEW.join_status = 'approved' AND OLD.join_status != 'approved' THEN
    -- 增加队伍人数
    UPDATE public.tasks_reward
    SET current_team_count = current_team_count + 1
    WHERE id = NEW.task_id::text::bigint
      AND type = 'team';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS tr_update_team_count_on_approval ON public.task_claims;

-- 创建新触发器
CREATE TRIGGER tr_update_team_count_on_approval
  AFTER UPDATE OF join_status ON public.task_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.update_team_count_on_approval();

-- 创建通知函数：当有组队申请时通知任务发起者
CREATE OR REPLACE FUNCTION public.notify_publisher_on_team_request()
RETURNS TRIGGER AS $$
DECLARE
  v_publisher_id UUID;
  v_task_title TEXT;
  v_claimant_name TEXT;
  v_publisher_name TEXT;
BEGIN
  -- 只处理新的待审核申请
  IF NEW.join_status = 'pending' AND (OLD.join_status IS NULL OR OLD.join_status != 'pending') THEN
    -- 获取任务信息和发布者
    SELECT user_id, title INTO v_publisher_id, v_task_title
    FROM public.tasks_reward
    WHERE id = NEW.task_id::text::bigint
    LIMIT 1;

    -- 获取申请者昵称
    v_claimant_name := COALESCE(NEW.claimant_nickname, '一位用户');

    -- 获取发布者昵称
    SELECT COALESCE(full_name, '任务发布者') INTO v_publisher_name
    FROM public.profiles
    WHERE id = v_publisher_id
    LIMIT 1;

    -- 插入通知
    INSERT INTO public.notifications (user_id, type, title, content, related_link, is_read)
    VALUES (
      v_publisher_id,
      'team_join_request',
      '组队申请待审核',
      v_claimant_name || ' 申请加入您的组队任务「' || v_task_title || '」，请及时审核。',
      '/?task_id=' || NEW.task_id,
      false
    );
  END IF;

  -- 当申请被审核通过时，通知申请者
  IF NEW.join_status = 'approved' AND OLD.join_status = 'pending' THEN
    -- 获取任务信息
    SELECT title INTO v_task_title
    FROM public.tasks_reward
    WHERE id = NEW.task_id::text::bigint
    LIMIT 1;

    -- 通知申请者
    INSERT INTO public.notifications (user_id, type, title, content, related_link, is_read)
    VALUES (
      NEW.claimant_id,
      'team_join_approved',
      '组队申请已通过',
      '您申请加入「' || v_task_title || '」的组队已通过审核，欢迎加入！',
      '/?task_id=' || NEW.task_id,
      false
    );
  END IF;

  -- 当申请被拒绝时，通知申请者
  IF NEW.join_status = 'rejected' AND OLD.join_status = 'pending' THEN
    -- 获取任务信息
    SELECT title INTO v_task_title
    FROM public.tasks_reward
    WHERE id = NEW.task_id::text::bigint
    LIMIT 1;

    -- 通知申请者
    INSERT INTO public.notifications (user_id, type, title, content, related_link, is_read)
    VALUES (
      NEW.claimant_id,
      'team_join_rejected',
      '组队申请未通过',
      '很遗憾，您申请加入「' || v_task_title || '」的组队未通过审核。',
      '/?task_id=' || NEW.task_id,
      false
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS tr_notify_publisher_on_team_request ON public.task_claims;

-- 创建新触发器
CREATE TRIGGER tr_notify_publisher_on_team_request
  AFTER INSERT OR UPDATE OF join_status ON public.task_claims
  FOR EACH ROW
  WHEN (NEW.join_status = 'pending' OR NEW.join_status = 'approved' OR NEW.join_status = 'rejected')
  EXECUTE FUNCTION public.notify_publisher_on_team_request();

-- 授予必要权限
GRANT EXECUTE ON FUNCTION public.update_team_count_on_approval() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_publisher_on_team_request() TO authenticated;
