-- 修复群聊 RLS 策略，确保 406 错误不会发生
-- 406 Not Acceptable 通常是因为 RLS 策略拒绝访问

-- 1. 删除并重新创建 group_chats 的 SELECT 策略
DROP POLICY IF EXISTS "Users can view group chats they are members of" ON public.group_chats;

CREATE POLICY "Users can view group chats they are members of"
  ON public.group_chats
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = group_chats.id
      AND group_members.user_id = auth.uid()::text
    )
  );

-- 2. 确保 group_chats 有 INSERT 策略（如果不存在）
DROP POLICY IF EXISTS "Users can insert group chats" ON public.group_chats;

CREATE POLICY "Users can insert group chats"
  ON public.group_chats
  FOR INSERT
  WITH CHECK (true);

-- 3. 确保 group_chats 有 UPDATE 策略
DROP POLICY IF EXISTS "Users can update group chats" ON public.group_chats;

CREATE POLICY "Users can update group chats"
  ON public.group_chats
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 4. 检查并修复 group_members 的 SELECT 策略
DROP POLICY IF EXISTS "Users can view group members" ON public.group_members;

CREATE POLICY "Users can view group members"
  ON public.group_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()::text
    )
  );

-- 5. 确保 group_members 有 INSERT 策略
DROP POLICY IF EXISTS "Users can insert group members" ON public.group_members;

CREATE POLICY "Users can insert group members"
  ON public.group_members
  FOR INSERT
  WITH CHECK (true);

-- 6. 确保 group_members 有 DELETE 策略
DROP POLICY IF EXISTS "Users can delete group members" ON public.group_members;

CREATE POLICY "Users can delete group members"
  ON public.group_members
  FOR DELETE
  USING (true);

-- 7. 检查并修复 group_messages 的 SELECT 策略
DROP POLICY IF EXISTS "Users can view group messages" ON public.group_messages;

CREATE POLICY "Users can view group messages"
  ON public.group_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = group_messages.group_id
      AND group_members.user_id = auth.uid()::text
    )
  );

-- 8. 确保 group_messages 有 INSERT 策略
DROP POLICY IF EXISTS "Users can insert group messages" ON public.group_messages;

CREATE POLICY "Users can insert group messages"
  ON public.group_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = group_messages.group_id
      AND group_members.user_id = auth.uid()::text
    )
  );

-- 9. 确保 group_messages 有正确的 UPDATE 策略（用于标记已读）
DROP POLICY IF EXISTS "Users can update group message read status" ON public.group_messages;

CREATE POLICY "Users can update group message read status"
  ON public.group_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = group_messages.group_id
      AND group_members.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = group_messages.group_id
      AND group_members.user_id = auth.uid()::text
    )
  );

-- 10. 确保 group_messages 有 DELETE 策略
DROP POLICY IF EXISTS "Users can delete group messages" ON public.group_messages;

CREATE POLICY "Users can delete group messages"
  ON public.group_messages
  FOR DELETE
  USING (auth.uid()::text = group_messages.sender_id);
