-- 启用 group_messages 表的 Realtime 功能
-- 这样其他用户才能实时接收到新消息
alter publication supabase_realtime add table public.group_messages;
