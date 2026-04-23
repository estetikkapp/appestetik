const MULTIPLIERS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export function normalizeCuit(cuit: string): string {
  return cuit.replace(/[\s-]/g, '');
}

/**
 * Valida un CUIT argentino verificando el dígito verificador.
 * Acepta con o sin guiones/espacios.
 */
export function isValidCuit(cuit: string | null | undefined): boolean {
  if (!cuit) return false;
  const normalized = normalizeCuit(cuit);
  if (!/^\d{11}$/.test(normalized)) return false;

  const digits = normalized.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += digits[i]! * MULTIPLIERS[i]!;
  }
  const mod = sum % 11;

  let checkDigit: number;
  if (mod === 0) {
    checkDigit = 0;
  } else if (mod === 1) {
    // Caso borde del algoritmo CUIT: se considera inválido
    return false;
  } else {
    checkDigit = 11 - mod;
  }

  return checkDigit === digits[10];
}
