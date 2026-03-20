-- 为 arena_submissions 表添加投稿人昵称和头像字段
ALTER TABLE arena_submissions
ADD COLUMN worker_nickname TEXT,
ADD COLUMN worker_avatar_url TEXT;

-- 添加注释
COMMENT ON COLUMN arena_submissions.worker_nickname IS '投稿人昵称快照';
COMMENT ON COLUMN arena_submissions.worker_avatar_url IS '投稿人头像URL快照';
