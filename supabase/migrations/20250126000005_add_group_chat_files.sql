-- 为群聊添加文件存储功能
-- 创建群聊文件表
CREATE TABLE IF NOT EXISTS public.group_chat_files (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  message_id INTEGER NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_group_chat_files_group_id ON public.group_chat_files(group_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_files_message_id ON public.group_chat_files(message_id);

-- 启用行级安全策略
ALTER TABLE public.group_chat_files ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果存在）
DROP POLICY IF EXISTS "Users can view files in their groups" ON public.group_chat_files;
DROP POLICY IF EXISTS "Users can upload files to their groups" ON public.group_chat_files;
DROP POLICY IF EXISTS "Users can delete their own files" ON public.group_chat_files;

-- 允许群组成员查看文件
CREATE POLICY "Users can view files in their groups"
  ON public.group_chat_files
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = group_chat_files.group_id
      AND group_members.user_id = auth.uid()::text
    )
  );

-- 允许群组成员上传文件
CREATE POLICY "Users can upload files to their groups"
  ON public.group_chat_files
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = group_chat_files.group_id
      AND group_members.user_id = auth.uid()::text
    )
  );

-- 允许上传者删除自己的文件
CREATE POLICY "Users can delete their own files"
  ON public.group_chat_files
  FOR DELETE
  USING (auth.uid()::text = uploaded_by);
-- 删除所有现有的 storage.objects 策略
DROP POLICY IF EXISTS "Authenticated users can upload group chat files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can download group chat files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their group chat files" ON storage.objects;
DROP POLICY IF EXISTS "Group members can download files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own uploaded files" ON storage.objects;

-- 创建简单的策略：允许认证用户进行所有操作
CREATE POLICY "All authenticated users can manage group chat files"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 注意：存储桶需要在 Supabase Dashboard 的 Storage 页面手动创建
-- 1. 打开 Supabase Dashboard
-- 2. 进入 Storage 页面
-- 3. 点击 "New bucket"
-- 4. 名称：group-chat-files
-- 5. Public bucket：关闭
-- 6. File size limit：52428800 (50MB)

COMMENT ON TABLE public.group_chat_files IS '群聊文件表，存储群聊中上传的文件信息';
COMMENT ON COLUMN public.group_chat_files.file_name IS '文件原始名称';
COMMENT ON COLUMN public.group_chat_files.file_path IS '文件在存储中的路径';
COMMENT ON COLUMN public.group_chat_files.file_size IS '文件大小（字节）';
COMMENT ON COLUMN public.group_chat_files.file_type IS '文件类型：image|document|video|audio|other';
COMMENT ON COLUMN public.group_chat_files.mime_type IS 'MIME类型';
