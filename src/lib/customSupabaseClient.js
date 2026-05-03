import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config';

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.warn('Supabase env vars missing: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
}

const customSupabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export default customSupabaseClient;

export {
  customSupabaseClient,
  customSupabaseClient as supabase,
};
