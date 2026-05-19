-- Add is_arena_admin field to profiles table for arena management permissions
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_arena_admin BOOLEAN DEFAULT FALSE;

-- Add is_approved field to arenas table for approval workflow
ALTER TABLE arenas ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

-- Add approved_at field to track approval time
ALTER TABLE arenas ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Add approved_by field to track who approved
ALTER TABLE arenas ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

-- Create index for faster queries on pending arenas
CREATE INDEX IF NOT EXISTS idx_arenas_is_approved ON arenas(is_approved);

-- Insert sample data for testing (optional - remove in production)
-- UPDATE arenas SET is_approved = true WHERE is_approved IS NULL;
