import { createClient } from '@supabase/supabase-js';


const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co') {
  console.warn('VITE_SUPABASE_URL is not configured.');
}

if (!supabaseAnonKey) {
  console.warn('VITE_SUPABASE_PUBLISHABLE_KEY is not configured.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

