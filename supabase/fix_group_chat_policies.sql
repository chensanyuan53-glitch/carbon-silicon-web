-- 允许认证用户插入群聊
CREATE POLICY "Users can insert group chats"
  ON public.group_chats
  FOR INSERT
  WITH CHECK (true);

-- 允许认证用户插入群成员
CREATE POLICY "Users can insert group members"
  ON public.group_members
  FOR INSERT
  WITH CHECK (true);

-- 允许认证用户更新群聊
CREATE POLICY "Users can update group chats"
  ON public.group_chats
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 允许认证用户删除群成员
CREATE POLICY "Users can delete group members"
  ON public.group_members
  FOR DELETE
  USING (true);

-- 允许认证用户删除群消息
CREATE POLICY "Users can delete group messages"
  ON public.group_messages
  FOR DELETE
  USING (auth.uid()::text = group_messages.sender_id);
