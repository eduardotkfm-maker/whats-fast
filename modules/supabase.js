import { createClient } from '@supabase/supabase-js';

// No Vite, variáveis de ambiente devem começar com VITE_ para serem expostas ao frontend
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase URL ou Anon Key não configurados no .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
