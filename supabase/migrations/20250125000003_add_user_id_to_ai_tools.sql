-- Add user_id field to ai_tools table for ownership tracking
-- Migration timestamp: 20250125000003

-- Add user_id column to ai_tools table
ALTER TABLE ai_tools
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index on user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_ai_tools_user_id ON ai_tools(user_id);

-- Update RLS policy to allow users to see their own tools
DROP POLICY IF EXISTS "Users can view all public tools" ON ai_tools;
CREATE POLICY "Users can view all public tools"
ON ai_tools FOR SELECT
USING (is_public = true);

-- Add policy to allow users to insert tools with their user_id
DROP POLICY IF EXISTS "Users can insert their own tools" ON ai_tools;
CREATE POLICY "Users can insert their own tools"
ON ai_tools FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add policy to allow users to update their own tools
DROP POLICY IF EXISTS "Users can update their own tools" ON ai_tools;
CREATE POLICY "Users can update their own tools"
ON ai_tools FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add policy to allow users to delete their own tools
DROP POLICY IF EXISTS "Users can delete their own tools" ON ai_tools;
CREATE POLICY "Users can delete their own tools"
ON ai_tools FOR DELETE
USING (auth.uid() = user_id);

-- Add policy to allow users to view their own tools (including private ones)
DROP POLICY IF EXISTS "Users can view their own tools" ON ai_tools;
CREATE POLICY "Users can view their own tools"
ON ai_tools FOR SELECT
USING (auth.uid() = user_id);
