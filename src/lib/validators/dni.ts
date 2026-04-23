/**
 * Normaliza un DNI argentino removiendo puntos y espacios.
 */
export function normalizeDni(input: string): string {
  return input.replace(/[\s.]/g, '');
}

/**
 * Valida un DNI argentino: 7 u 8 dígitos numéricos puros.
 */
export function isValidDni(input: string | null | undefined): boolean {
  if (!input) return false;
  const normalized = normalizeDni(input);
  return /^\d{7,8}$/.test(normalized);
}
