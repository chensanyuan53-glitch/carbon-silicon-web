# 任务大厅 Supabase 配置说明

如果「发布需求」提交后任务大厅列表没有显示新任务，多半是 **Row Level Security (RLS)** 未开放读写。

## 在 Supabase 控制台执行

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard) → 选择你的项目。
2. 左侧进入 **SQL Editor**，新建查询，粘贴下面 SQL 后执行。

### 允许匿名用户读写 `tasks` 表（开发/演示用）

```sql
-- 若表已有 RLS，先启用
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取
CREATE POLICY "tasks_select_policy"
ON public.tasks FOR SELECT
TO public
USING (true);

-- 允许所有人插入
CREATE POLICY "tasks_insert_policy"
ON public.tasks FOR INSERT
TO public
WITH CHECK (true);
```

若提示 policy 已存在，可先删除再建：

```sql
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
```

然后再执行上面的 `CREATE POLICY` 两句。

### 表结构建议

`tasks` 表建议包含列：

| 列名         | 类型        | 说明           |
|--------------|-------------|----------------|
| id           | uuid        | 主键，默认 `gen_random_uuid()` |
| created_at   | timestamptz | 默认 `now()`   |
| title        | text        | 标题           |
| description  | text        | 需求描述       |
| category     | text        | 领域（家装/农业/能源/职场/健康/宠物） |
| reward       | numeric     | 悬赏金额       |

若没有该表，可在 Table Editor 中新建表 `tasks` 并添加上述列。
