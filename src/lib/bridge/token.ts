/**
 * Helpers para tokens del bridge local (whatsapp-web.js agent).
 *
 * El token plaintext se muestra UNA SOLA VEZ al usuario al crearlo.
 * En DB solo guardamos sha256(token). Pattern estilo Stripe/GitHub API keys.
 *
 * Formato del token: `abp_<32 base64url chars>` (~ 26 bytes de entropía).
 * Prefijo `abp_` = appestetika bridge — facilita reconocer el tipo en logs.
 */

import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const TOKEN_PREFIX = 'abp_';
const TOKEN_BYTES = 24; // 24 bytes = 192 bits, codifica a ~32 chars base64url

/**
 * Genera un token nuevo. Retorna { plaintext, hash }.
 * El plaintext se muestra al user UNA vez; el hash se guarda en DB.
 */
export function generateBridgeToken(): { plaintext: string; hash: string } {
  const random = randomBytes(TOKEN_BYTES).toString('base64url');
  const plaintext = `${TOKEN_PREFIX}${random}`;
  const hash = hashBridgeToken(plaintext);
  return { plaintext, hash };
}

/**
 * Hash sha256 hex de un token plaintext.
 */
export function hashBridgeToken(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

/**
 * Compara dos hashes en timing-safe manner para evitar timing attacks.
 * Útil cuando comparamos el hash calculado del header Authorization contra
 * el hash guardado en DB.
 */
export function timingSafeHashCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Validación básica del formato sin tocar DB. Filtra tokens malformados
 * antes del lookup costoso.
 */
export function isValidTokenFormat(token: string | null | undefined): boolean {
  if (!token) return false;
  if (!token.startsWith(TOKEN_PREFIX)) return false;
  // 32 chars base64url después del prefix
  const body = token.slice(TOKEN_PREFIX.length);
  return body.length >= 28 && body.length <= 40 && /^[A-Za-z0-9_-]+$/.test(body);
}

/**
 * Extrae el token del header Authorization. Soporta:
 *   - Bearer <token>
 *   - Token <token>
 *   - <token> directo (fallback)
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const trimmed = authHeader.trim();
  const bearerMatch = trimmed.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) return bearerMatch[1]!.trim();
  const tokenMatch = trimmed.match(/^Token\s+(.+)$/i);
  if (tokenMatch) return tokenMatch[1]!.trim();
  return trimmed;
}
