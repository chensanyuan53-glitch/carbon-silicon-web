-- ============================================================
-- Add user nickname and avatar fields to comments table
-- 在评论表中添加用户昵称和头像字段（作为评论时的快照）
-- ============================================================

-- Add columns to comments table
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS user_nickname text,
  ADD COLUMN IF NOT EXISTS user_avatar_url text;

-- Add comment
COMMENT ON COLUMN public.comments.user_nickname IS '用户昵称（评论时快照）';
COMMENT ON COLUMN public.comments.user_avatar_url IS '用户头像URL（评论时快照）';

-- ============================================================
-- 完成提示
-- ============================================================
-- 此脚本已添加以下字段到 comments 表：
-- 1. user_nickname - 用户昵称（评论时的快照）
-- 2. user_avatar_url - 用户头像URL（评论时的快照）
--
-- 注意：这些字段存储的是评论时的用户信息，即使用户后来修改了昵称或头像，
-- 已发布的评论仍然显示评论时的信息，这是社交媒体的常见做法。
