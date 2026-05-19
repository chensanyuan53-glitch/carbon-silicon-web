-- Add is_pinned field to ai_news table for pinning news to top
ALTER TABLE ai_news ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_ai_news_is_pinned ON ai_news(is_pinned);

-- Update RLS policies to allow admins to update is_pinned
-- (Users can update their own news as before)
-- Admins can update is_pinned for any news
