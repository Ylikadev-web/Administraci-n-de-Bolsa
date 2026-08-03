import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

/**
 * IMPORTANT: Next.js only inlines `process.env.NEXT_PUBLIC_*` when the key is
 * a static string literal. Dynamic access like `process.env[name]` is `undefined`
 * in the browser and breaks login in production.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. Revisa las variables de entorno en Vercel.",
    );
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
