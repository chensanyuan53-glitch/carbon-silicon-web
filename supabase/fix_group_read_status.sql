-- 修复群聊消息已读状态的RLS策略
-- 允许群成员更新消息的已读状态（不仅仅是发送者）
DROP POLICY IF EXISTS "Users can update message read status" ON public.group_messages;

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
