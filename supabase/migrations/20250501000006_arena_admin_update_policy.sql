-- 为 arenas 表添加审核管理员审核策略
-- 只有审核管理员可以更新 is_approved 字段

-- 1. 添加审核管理员更新策略（仅允许更新 is_approved 相关字段）
CREATE POLICY "Arena admins can approve arenas" ON arenas
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_arena_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_arena_admin = true
  )
);

-- 2. 确保所有人都可以 SELECT arenas（用于列表展示）
-- 如果已经存在 SELECT 策略则跳过
DROP POLICY IF EXISTS "Anyone can view arenas" ON arenas;
CREATE POLICY "Anyone can view arenas" ON arenas
FOR SELECT
USING (true);

-- 3. 确保竞技场创建者可以更新自己的竞技场（更新基本信息）
DROP POLICY IF EXISTS "Creators can update their arenas" ON arenas;
CREATE POLICY "Creators can update their arenas" ON arenas
FOR UPDATE
TO authenticated
USING (auth.uid() = creator_id);

-- 4. 确保认证用户可以插入竞技场
DROP POLICY IF EXISTS "Authenticated users can create arenas" ON arenas;
CREATE POLICY "Authenticated users can create arenas" ON arenas
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = creator_id);
