/**
 * Auth helper para endpoints de bridge.
 *
 * Cada request del bridge incluye Authorization: Bearer <token>. Acá hasheamos
 * y resolvemos contra DB. Retornamos { tokenId, orgId } o null si inválido.
 */

import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  extractTokenFromHeader,
  hashBridgeToken,
  isValidTokenFormat,
} from './token';

export interface BridgeAuthSuccess {
  ok: true;
  tokenId: string;
  organizationId: string;
}

export interface BridgeAuthFailure {
  ok: false;
  status: number;
  error: string;
}

export type BridgeAuthResult = BridgeAuthSuccess | BridgeAuthFailure;

export async function authenticateBridge(req: NextRequest): Promise<BridgeAuthResult> {
  const token = extractTokenFromHeader(req.headers.get('authorization'));

  if (!isValidTokenFormat(token)) {
    return { ok: false, status: 401, error: 'invalid token format' };
  }

  const hash = hashBridgeToken(token!);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('bridge_tokens')
    .select('id, organization_id, revoked_at')
    .eq('token_hash', hash)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, status: 401, error: 'token not found' };
  }
  if (data.revoked_at) {
    return { ok: false, status: 401, error: 'token revoked' };
  }

  // Touch last_seen — fire-and-forget no-await sería ideal pero await es
  // <50ms y mantiene consistencia simple. En endpoints high-volume podríamos
  // mover a una queue.
  await admin
    .from('bridge_tokens')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', data.id);

  return { ok: true, tokenId: data.id, organizationId: data.organization_id };
}
