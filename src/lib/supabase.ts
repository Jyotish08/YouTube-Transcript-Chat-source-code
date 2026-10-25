import { createClient } from '@supabase/supabase-js';

export const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://kczhvclsdjdkmxpnawib.supabase.co';

export const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_ZuXO-a7ilo4XwydgX-262g_SulIrCO7';

export const supabase = createClient(supabaseUrl, supabaseKey);
