import { formatInTimeZone } from 'date-fns-tz';
import { parseISO, isValid } from 'date-fns';

export const AR_TIMEZONE = 'America/Argentina/Buenos_Aires';

function toDate(input: Date | string): Date | null {
  if (input instanceof Date) return isValid(input) ? input : null;
  if (typeof input === 'string' && input) {
    const parsed = parseISO(input);
    return isValid(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Formatea una fecha (Date o string ISO) a DD/MM/YYYY en timezone AR.
 */
export function formatDateAr(input: Date | string): string {
  const date = toDate(input);
  if (!date) return '';
  return formatInTimeZone(date, AR_TIMEZONE, 'dd/MM/yyyy');
}

/**
 * Formatea una fecha a DD/MM/YYYY HH:mm en timezone AR.
 */
export function formatDateTimeAr(input: Date | string): string {
  const date = toDate(input);
  if (!date) return '';
  return formatInTimeZone(date, AR_TIMEZONE, 'dd/MM/yyyy HH:mm');
}
