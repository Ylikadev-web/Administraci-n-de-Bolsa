import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variable de entorno faltante: ${name}. Configura las variables de Supabase (ver README).`,
    );
  }
  return value;
}

export function createClient() {
  return createBrowserClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}
