/**
 * Formatea un número a pesos argentinos con separador de miles (.)
 * y decimal (,). Ej: 15990 → "$15.990", 1000.5 → "$1.000,50"
 */
export function formatArs(amount: number): string {
  if (!Number.isFinite(amount)) return '$0';
  const absValue = Math.abs(amount);
  const hasCents = absValue % 1 !== 0;
  const formatter = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
  const formatted = formatter.format(absValue);
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${formatted}`;
}

/**
 * Parsea un string en formato ARS ($15.990 o 15.990,50) a número.
 * Retorna NaN si no es parseable.
 */
export function parseArs(input: string): number {
  if (!input) return NaN;
  const clean = input.replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : NaN;
}
