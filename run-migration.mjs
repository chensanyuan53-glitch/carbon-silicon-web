import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取环境变量
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rfyrlejrmmzmwblqbyix.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_KEY || 'sb_publishable_IgWT2oDi2uqTqG7IAGnEVw_KRczteOQ';

console.log('Supabase URL:', supabaseUrl);

// 创建 Supabase 客户端（使用 service role key 或 admin key 以便执行 DDL）
const supabase = createClient(supabaseUrl, supabaseKey);

// 读取并执行迁移文件
async function runMigration() {
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250125000003_add_user_id_to_ai_tools.sql');
  
  try {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('读取迁移文件成功');
    console.log('SQL 内容:', sql.substring(0, 100) + '...');
    
    // 注意：使用客户端执行 DDL 可能需要 service role key
    // 如果失败，请手动在 Supabase Dashboard 中执行 SQL
    console.log('\n⚠️  提示：请使用 Supabase Dashboard 执行以下步骤：');
    console.log('1. 访问 https://app.supabase.com/project/rfyrlejrmmzmwblqbyix/sql/new');
    console.log('2. 复制并粘贴迁移文件内容：', migrationPath);
    console.log('3. 点击 "Run" 执行 SQL\n');
    
    console.log('迁移文件内容:');
    console.log('='.repeat(80));
    console.log(sql);
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('执行迁移失败:', error.message);
  }
}

runMigration();
