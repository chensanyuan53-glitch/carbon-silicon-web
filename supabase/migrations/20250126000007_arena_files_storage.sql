-- 竞技场投稿文件存储桶策略（桶名：arena-files）
-- 在 Dashboard → Storage 新建桶：arena-files，勾选 Public（便于 getPublicUrl 直链展示）

-- 清理已存在的策略（避免重复创建报错）
DROP POLICY IF EXISTS "Public read arena files" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own arena files" ON storage.objects;
DROP POLICY IF EXISTS "Users update own arena files" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own arena files" ON storage.objects;

-- 允许所有人读取竞技场文件
CREATE POLICY "Public read arena files"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'arena-files');

-- 允许认证用户上传文件到自己的文件夹
CREATE POLICY "Users upload own arena files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'arena-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 允许用户更新自己的文件
CREATE POLICY "Users update own arena files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'arena-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 允许用户删除自己的文件
CREATE POLICY "Users delete own arena files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'arena-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
