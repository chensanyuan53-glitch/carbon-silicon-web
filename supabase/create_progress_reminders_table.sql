-- 创建进度提醒记录表
CREATE TABLE IF NOT EXISTS public.progress_reminders (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES public.group_chats(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  reminder_type TEXT NOT NULL, -- '24h_active', '3_days', '7_days', '14_days'
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL, -- 计划发送时间
  sent_at TIMESTAMP WITH TIME ZONE, -- 实际发送时间
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'sent' | 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_progress_reminders_group_id ON public.progress_reminders(group_id);
CREATE INDEX IF NOT EXISTS idx_progress_reminders_task_id ON public.progress_reminders(task_id);
CREATE INDEX IF NOT EXISTS idx_progress_reminders_status ON public.progress_reminders(status);
CREATE INDEX IF NOT EXISTS idx_progress_reminders_scheduled_at ON public.progress_reminders(scheduled_at);

-- 启用 RLS
ALTER TABLE public.progress_reminders ENABLE ROW LEVEL SECURITY;

-- RLS 策略：只有服务角色可以访问（Edge Function 使用）
CREATE POLICY "Service role can manage progress reminders"
  ON public.progress_reminders
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 创建更新时间戳的触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_progress_reminders_updated_at
  BEFORE UPDATE ON public.progress_reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
