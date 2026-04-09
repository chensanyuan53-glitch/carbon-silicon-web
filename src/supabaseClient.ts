import { createClient } from '@supabase/supabase-js';

// trim：避免 .env 中 CRLF/空格导致请求 URL 或 apikey 非法，进而出现网关 HTML 400
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '');
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
