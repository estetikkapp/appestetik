/**
 * Traduce errores comunes de Postgres/Supabase a mensajes amigables en español.
 * Útil para mostrar al usuario en lugar del mensaje técnico crudo.
 */
export function translateDbError(error: { message?: string; code?: string }): string {
  const code = error.code;
  const msg = error.message ?? '';

  // 23503: foreign_key_violation — registro tiene relaciones que lo impiden borrar
  if (code === '23503' || msg.includes('foreign key') || msg.includes('violates foreign key')) {
    return 'No se puede eliminar porque tiene registros asociados (turnos, pagos, etc.). Archivá en su lugar.';
  }
  // 23505: unique_violation
  if (code === '23505' || msg.includes('duplicate key')) {
    return 'Ya existe un registro con esos datos.';
  }
  // 23502: not_null_violation
  if (code === '23502' || msg.includes('not-null')) {
    return 'Faltan campos obligatorios.';
  }
  // 23514: check_violation
  if (code === '23514' || msg.includes('check constraint')) {
    return 'Algún valor no cumple las reglas de validación.';
  }
  // RLS — sin permisos
  if (msg.includes('row-level security') || msg.includes('RLS')) {
    return 'No tenés permiso para hacer esto.';
  }
  return msg || 'Ocurrió un error inesperado.';
}
