-- Sync profiles table with auth.users metadata
-- This creates or updates profiles for existing users who signed up before the profiles table was created

-- Insert missing profiles from auth.users
INSERT INTO public.profiles (id, email, full_name, avatar_url, is_admin)
SELECT 
  au.id,
  au.email,
  COALESCE(p.full_name, au.raw_user_meta_data->>'nickname'),
  COALESCE(p.avatar_url, au.raw_user_meta_data->>'avatar_url'),
  COALESCE(p.is_admin, false)
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- Update existing profiles with latest metadata from auth.users
UPDATE public.profiles p
SET 
  email = COALESCE(p.email, au.email),
  full_name = COALESCE(p.full_name, au.raw_user_meta_data->>'nickname'),
  avatar_url = COALESCE(p.avatar_url, au.raw_user_meta_data->>'avatar_url')
FROM auth.users au
WHERE p.id = au.id 
  AND (p.full_name IS NULL OR p.avatar_url IS NULL);
