-- 调试：临时禁用 RLS 以测试功能
-- 注意：生产环境不要使用，仅用于调试！

-- ALTER TABLE public.group_chats DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.group_messages DISABLE ROW LEVEL SECURITY;

-- 如果上面不行，可以尝试删除所有策略重新创建：
-- DROP POLICY IF EXISTS "Users can view group chats they are members of" ON public.group_chats;
-- DROP POLICY IF EXISTS "Users can view group members" ON public.group_members;
-- DROP POLICY IF EXISTS "Users can view group messages" ON public.group_messages;
-- DROP POLICY IF EXISTS "Users can insert group messages" ON public.group_messages;
-- DROP POLICY IF EXISTS "Users can update message read status" ON public.group_messages;

-- 查看当前所有策略
SELECT * FROM pg_policies WHERE tablename IN ('group_chats', 'group_members', 'group_messages');
