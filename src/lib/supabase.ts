import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tpiohvdmwkqndgifwngg.supabase.co';
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwaW9odmRtd2txbmRnaWZ3bmdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3Nzg2NTUsImV4cCI6MjEwMTM1NDY1NX0.tRPmCo1NTnoQfyuiBC5k-RW86pGlKfviYI28DfloKOM';

export const supabase = createClient(supabaseUrl, supabaseKey);