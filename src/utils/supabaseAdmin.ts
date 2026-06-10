import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Falta VITE_SUPABASE_URL en el entorno del servidor. Revisa tu archivo .env",
  );
}

if (!serviceRoleKey) {
  throw new Error(
    "Falta SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor. Revisa tu archivo .env",
  );
}

/** Cliente Supabase con service role — solo importar desde handlers de servidor. */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
