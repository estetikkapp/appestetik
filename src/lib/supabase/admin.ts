import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Cliente Supabase con service_role key.
 * NUNCA importar desde Client Components — expone permisos admin.
 * Usar solo en Server Actions / API routes / Server Components donde se necesita
 * bypasear RLS (ej: operaciones admin, invitaciones, seeders).
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}
