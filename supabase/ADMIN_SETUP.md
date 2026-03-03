# 管理员权限设置说明

## 方案说明

本方案使用 `profiles` 表中的 `is_admin` 字段来判断用户是否为管理员，相比邮箱域名判断更加灵活和安全。

## 实施步骤

### 1. 执行数据库迁移

运行以下命令创建 profiles 表和 is_admin 字段：

```bash
# 使用 Supabase CLI（推荐）
supabase db push

# 或者手动执行 SQL 文件
# 登录 Supabase 控制台 -> SQL Editor -> 运行 migrations/20250125000006_add_is_admin_field.sql 中的 SQL 语句
```

### 2. 设置用户为管理员

有两种方式设置用户为管理员：

#### 方式一：通过 Supabase 控制台

1. 登录 [Supabase 控制台](https://app.supabase.com)
2. 进入项目的 Table Editor
3. 找到 `profiles` 表
4. 找到要设置为管理员的用户（通过 id、email 等识别）
5. 将 `is_admin` 字段设置为 `true`
6. 点击保存

#### 方式二：通过 SQL 直接执行

```sql
-- 将某个用户设置为管理员（替换用户 ID）
UPDATE public.profiles
SET is_admin = true
WHERE id = '用户_UUID';

-- 通过邮箱查找并设置管理员
UPDATE public.profiles
SET is_admin = true
WHERE email = 'your-email@example.com';

-- 查看所有管理员
SELECT * FROM public.profiles
WHERE is_admin = true;
```

### 3. 验证功能

1. 退出登录后重新登录，系统会自动从 profiles 表读取管理员状态
2. 只有 `is_admin = true` 的用户才能看到和操作编辑/删除按钮
3. 普通用户只能查看内容，无法修改或删除

## profiles 表结构

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 用户 ID（关联 auth.users） |
| email | TEXT | 用户邮箱 |
| full_name | TEXT | 用户全名 |
| avatar_url | TEXT | 头像 URL |
| is_admin | BOOLEAN | 是否为管理员（默认 false） |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

## 技术细节

- 当用户注册时，系统会自动在 profiles 表中创建对应的记录
- 新注册的用户 `is_admin` 默认为 `false`
- 使用 Row Level Security (RLS) 保护数据安全
- 前端在登录时会查询 `profiles` 表获取 `is_admin` 状态

## 注意事项

1. 只有具有数据库管理权限的用户才能修改 `is_admin` 字段
2. 建议通过 Supabase 控制台的 Table Editor 修改，避免直接执行 SQL
3. 修改 `is_admin` 后，用户需要重新登录才能生效
4. 确保执行了正确的 SQL 迁移文件：`20250125000006_add_is_admin_field.sql`

## 故障排查

### 问题：编辑/删除按钮仍然不显示

**检查步骤：**
1. 确认已执行数据库迁移
2. 在 Supabase 控制台确认 profiles 表存在
3. 确认该用户的 `is_admin` 字段为 `true`
4. 退出登录后重新登录
5. 检查浏览器控制台是否有错误信息

### 问题：找不到 profiles 表

**解决方法：**
确认已执行迁移文件 `20250125000006_add_is_admin_field.sql`，或在 Supabase 控制台的 SQL Editor 中手动执行该文件中的 SQL 语句。

### 问题：现有用户没有 profiles 记录

**解决方法：**
执行以下 SQL 为现有用户创建 profiles 记录：

```sql
INSERT INTO public.profiles (id, email, is_admin)
SELECT id, email, FALSE
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);
```
