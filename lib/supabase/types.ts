/**
 * Tipos generados manualmente para la base de datos.
 *
 * En cuanto conectemos con un proyecto real de Supabase, esta definición se
 * reemplaza automáticamente con:
 *   npx supabase gen types typescript --project-id XXXX > lib/supabase/types.ts
 *
 * Mientras tanto, este archivo evita romper el build.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
