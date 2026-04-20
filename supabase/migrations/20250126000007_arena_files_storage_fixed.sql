-- 竞技场投稿文件存储桶策略（桶名：arena-files）
-- 先创建存储桶 arena-files，勾选 Public

-- 清理已存在的策略
DROP POLICY IF EXISTS "Public read arena files" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own arena files" ON storage.objects;
DROP POLICY IF EXISTS "Users update own arena files" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own arena files" ON storage.objects;

-- 允许所有人读取
CREATE POLICY "Public read arena files"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'arena-files');

-- 允许认证用户上传
CREATE POLICY "Users upload own arena files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'arena-files');

-- 允许认证用户更新
CREATE POLICY "Users update own arena files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'arena-files');

-- 允许认证用户删除
CREATE POLICY "Users delete own arena files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'arena-files');
