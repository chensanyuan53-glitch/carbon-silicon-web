-- 检查触发器是否存在
SELECT
  trigger_name,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'tr_notify_seller_on_inquiry';
