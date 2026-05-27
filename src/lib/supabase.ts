import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Faltan las variables de entorno de Supabase en el Frontend. Revisa tu archivo .env');
}

// Inicializamos el cliente de Supabase listo para usar Auth y consultas
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');