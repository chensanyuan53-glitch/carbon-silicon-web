-- 添加 sender_email 列到 messages 表
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_email TEXT NOT NULL DEFAULT '';
