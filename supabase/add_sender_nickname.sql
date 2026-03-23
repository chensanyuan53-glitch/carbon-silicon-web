-- 添加 sender_nickname 字段到 messages 表
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_nickname TEXT;
