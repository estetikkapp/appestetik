/**
 * Formatea un teléfono E.164 argentino a un display humano.
 * +5491112345678 → "+54 9 11 1234-5678"
 * +541145678900 → "+54 11 4567-8900"
 */
export function formatPhoneDisplay(input: string): string {
  if (!input) return '';
  // Celular: +549 + 2 dígitos area + 8 dígitos número
  const mobileMatch = input.match(/^\+549(\d{2,4})(\d{4})(\d{4})$/);
  if (mobileMatch) {
    return `+54 9 ${mobileMatch[1]} ${mobileMatch[2]}-${mobileMatch[3]}`;
  }
  // Landline: +54 + 2-4 dígitos area + resto
  const landlineMatch = input.match(/^\+54(\d{2,4})(\d{4})(\d{4})$/);
  if (landlineMatch) {
    return `+54 ${landlineMatch[1]} ${landlineMatch[2]}-${landlineMatch[3]}`;
  }
  return input;
}
