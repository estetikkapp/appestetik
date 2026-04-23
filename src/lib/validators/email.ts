import { z } from 'zod';

const emailSchema = z.string().email();

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidEmail(input: string | null | undefined): boolean {
  if (!input) return false;
  return emailSchema.safeParse(input.trim()).success;
}
