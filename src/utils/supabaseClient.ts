import { createClient } from '@supabase/supabase-js';

// As variáveis de ambiente do Vite começam com VITE_
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('VITE_SUPABASE_URL') || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('VITE_SUPABASE_ANON_KEY') || '';

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as any);

