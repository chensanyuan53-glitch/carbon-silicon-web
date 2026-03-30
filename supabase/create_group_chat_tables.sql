-- 创建群聊表
CREATE TABLE IF NOT EXISTS public.group_chats (
  id SERIAL PRIMARY KEY,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 创建群成员表
CREATE TABLE IF NOT EXISTS public.group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- 'member' | 'bot'
  nickname TEXT,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 创建群消息表
CREATE TABLE IF NOT EXISTS public.group_messages (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_nickname TEXT,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text', -- 'text' | 'system' | 'status' | 'file'
  is_bot BOOLEAN DEFAULT FALSE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_group_chats_task_id ON public.group_chats(task_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_group_id ON public.group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_created_at ON public.group_messages(created_at);

-- 启用行级安全策略
ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- 允许所有认证用户读取群聊（如果是成员）
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

-- 允许所有认证用户读取群成员
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

-- 允许所有认证用户读取群消息（如果是成员）
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

-- 允许认证用户插入群消息（如果是成员）
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

-- 允许用户更新自己的消息已读状态
CREATE POLICY "Users can update message read status"
  ON public.group_messages
  FOR UPDATE
  USING (auth.uid()::text = group_messages.sender_id)
  WITH CHECK (auth.uid()::text = group_messages.sender_id);
