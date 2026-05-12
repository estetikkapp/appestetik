/**
 * Normaliza un teléfono argentino a formato E.164.
 * Celular esperado: +549 + area + número (13 dígitos post +)
 * Landline esperado: +54 + area + número (12 dígitos post +)
 *
 * Asumimos celular cuando no podemos determinar (caso más común y crítico
 * para WhatsApp — los celulares argentinos requieren el "9" después de +54
 * o WA no los reconoce).
 */
export function normalizePhoneAr(input: string): string {
  if (!input) return '';
  const trimmed = input.replace(/[\s\-()]/g, '');

  if (trimmed.startsWith('+')) {
    return trimmed;
  }

  // Si empieza con 549, ya tiene código país + 9 (celular)
  if (trimmed.startsWith('549')) {
    return '+' + trimmed;
  }

  // Si empieza con 54 (sin el 9), y los siguientes 10 dígitos parecen celular
  // (típicamente arrancan con 11/15/2xx/3xx), insertamos el 9. Asumimos celular
  // porque es lo más común y porque WhatsApp solo funciona con celulares.
  if (trimmed.startsWith('54') && /^54\d{10}$/.test(trimmed)) {
    return '+549' + trimmed.slice(2);
  }

  // Si empieza con 9 + 10 dígitos, asumimos celular sin código país
  if (/^9\d{10}$/.test(trimmed)) {
    return '+54' + trimmed;
  }

  // 10 dígitos sin nada: número argentino típico sin código país ni el 9.
  // Asumimos celular y agregamos +549.
  if (/^\d{10}$/.test(trimmed)) {
    return '+549' + trimmed;
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
