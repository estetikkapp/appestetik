/**
 * Normaliza un teléfono argentino a formato E.164.
 * Celular esperado: +549 + area + número (13 dígitos post +)
 * Landline esperado: +54 + area + número (12 dígitos post +)
 */
export function normalizePhoneAr(input: string): string {
  if (!input) return '';
  const trimmed = input.replace(/[\s\-()]/g, '');

  if (trimmed.startsWith('+')) {
    return trimmed;
  }

  // Si empieza con 549 o 54, agregar solo el '+'
  if (trimmed.startsWith('549') || trimmed.startsWith('54')) {
    return '+' + trimmed;
  }

  // Si empieza con 9 + 10 dígitos, asumimos celular sin código país
  if (/^9\d{10}$/.test(trimmed)) {
    return '+54' + trimmed;
  }

  // Fallback: prepend +54 (isValidPhoneAr lo rechazará si no es válido)
  return '+54' + trimmed;
}

/**
 * Valida formato E.164 de teléfono argentino (celular o landline).
 */
export function isValidPhoneAr(input: string | null | undefined): boolean {
  if (!input) return false;
  const normalized = input.startsWith('+') ? input.replace(/[\s\-()]/g, '') : normalizePhoneAr(input);
  // Celular: +549 + 10 dígitos
  if (/^\+549\d{10}$/.test(normalized)) return true;
  // Landline: +54 + 10 dígitos (y NO empieza con +549)
  if (/^\+54\d{10}$/.test(normalized) && !normalized.startsWith('+549')) return true;
  return false;
}
