-- 为 arenas 表添加删除策略
-- 只有创建者可以删除自己的竞技场

-- 1. 先确保 RLS 已启用（如果没启用）
ALTER TABLE arenas ENABLE ROW LEVEL SECURITY;

-- 2. 删除已有的删除策略（如果有）
DROP POLICY IF EXISTS "Allow creator to delete arena" ON arenas;
DROP POLICY IF EXISTS "Users can delete their own arenas" ON arenas;

-- 3. 创建新的删除策略：只有创建者可以删除
CREATE POLICY "Allow creator to delete arena" ON arenas
FOR DELETE
TO authenticated
USING (auth.uid() = creator_id);

-- 4. 同样为 arena_submissions 表添加删除策略
ALTER TABLE arena_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow creator to delete submissions" ON arena_submissions;

CREATE POLICY "Allow creator to delete submissions" ON arena_submissions
FOR DELETE
TO authenticated
USING (
  -- 创建者可以删除自己竞技场的所有投稿
  EXISTS (
    SELECT 1 FROM arenas 
    WHERE arenas.id = arena_submissions.arena_id 
    AND arenas.creator_id = auth.uid()
  )
  OR
  -- 投稿者可以删除自己的投稿
  auth.uid() = arena_submissions.worker_id
);
