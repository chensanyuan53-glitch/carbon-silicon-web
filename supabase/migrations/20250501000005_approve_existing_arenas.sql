-- Approve all existing arenas (they were created before the approval system)
-- Run this after adding the is_approved column to set existing arenas as approved
UPDATE arenas SET is_approved = true WHERE is_approved IS NULL OR is_approved = false;
