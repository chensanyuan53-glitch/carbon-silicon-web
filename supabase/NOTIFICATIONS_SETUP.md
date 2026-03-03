# 通知功能设置说明

接单后发布者收不到小铃铛通知时，请按下面步骤排查。

## 1. 确认已执行数据库迁移

通知依赖 **数据库触发器**，必须先在 Supabase 执行过建表与触发器 SQL。

- 打开 [Supabase Dashboard](https://supabase.com/dashboard) → 你的项目 → **SQL Editor**
- 打开项目里的 `supabase/migrations/20250125000000_notifications.sql`
- **整段复制到 SQL 编辑器并点击 Run**，确保没有报错

若之前已经跑过该文件，可再执行一次（脚本里用了 `CREATE OR REPLACE` 和 `DROP TRIGGER IF EXISTS`，重复执行是安全的）。

## 2. 验证触发器是否存在

在 SQL Editor 中执行：

```sql
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname = 'tr_notify_creator_on_task_claim';
```

应返回一行，说明触发器已创建。

## 3. 验证是否有通知写入

接单后执行：

```sql
SELECT id, user_id, title, content, created_at
FROM public.notifications
ORDER BY created_at DESC
LIMIT 5;
```

若有新接单但这里始终没有新行，多半是触发器未创建或执行失败，请回到步骤 1 重新执行迁移。

## 4. 确认表名和字段

本触发器挂在 **task_claims** 表上，且从 **tasks_reward** 表取任务信息。请确认：

- 存在表 `public.task_claims`，且包含列：`task_id`、`claimant_id`、`claimed_at`
- 存在表 `public.tasks_reward`，且包含列：`id`、`user_id`、`title`

若你的表名/列名不同，需要相应修改迁移脚本中的表名和字段名后再执行。

---

执行完迁移并确认触发器、表结构无误后，用户接单时应会自动插入一条通知，发布者刷新或重新打开页面后即可在小铃铛处看到未读通知。
