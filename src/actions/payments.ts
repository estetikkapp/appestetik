'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { translateDbError } from '@/lib/utils/db-errors';
import { createPaymentPreference } from '@/lib/integrations/mercadopago/client';
import { requireMembership } from '@/lib/auth/require-membership';

async function getActiveOrgOrRedirect(): Promise<string> {
  // Verifica user logueado + membership activo. Crítico porque
  // createPaymentPreference usa createAdminClient (bypass RLS) — sin esto,
  // tampering de cookie active_org permitiría crear pagos en otra org.
  const { orgId } = await requireMembership();
  return orgId;
}

/**
 * Registra un pago manual (efectivo/transferencia/etc.).
 * Para pagos via MP, usar createMpPaymentLink.
 */
export async function recordManualPayment(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const clientId = String(formData.get('client_id') ?? '');
  const appointmentId = String(formData.get('appointment_id') ?? '') || null;
  const amountArs = Number(formData.get('amount_ars') ?? 0);
  const method = String(formData.get('method') ?? 'cash') as
    | 'cash'
    | 'mp_card'
    | 'transfer'
    | 'package_credit';
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!clientId || amountArs <= 0) redirect('/cobros?error=Datos+invalidos');

  const supabase = createClient();
  const { error } = await supabase.from('payments').insert({
    organization_id: orgId,
    client_id: clientId,
    appointment_id: appointmentId,
    amount_ars: amountArs,
    method,
    status: 'approved',
    paid_at: new Date().toISOString(),
    notes,
  });

  if (error) redirect(`/cobros?error=${encodeURIComponent(translateDbError(error))}`);

  revalidatePath('/cobros');
  redirect('/cobros?ok=registrado');
}

/**
 * Crea una payment preference en MP y guarda el link asociado al pago.
 * Si MP no está configurado, retorna error informativo.
 */
export async function createMpPaymentLink(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const clientId = String(formData.get('client_id') ?? '');
  const appointmentId = String(formData.get('appointment_id') ?? '') || null;
  const amountArs = Number(formData.get('amount_ars') ?? 0);
  const description = String(formData.get('description') ?? 'Servicio estética');

  if (!clientId || amountArs <= 0) redirect('/cobros?error=Datos+invalidos');

  const supabase = createClient();

  const { data: client } = await supabase
    .from('clients')
    .select('email, full_name')
    .eq('id', clientId)
    .eq('organization_id', orgId)
    .maybeSingle();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://estetikkapp.com';
  let result;
  try {
    result = await createPaymentPreference({
      orgId,
      appointmentId: appointmentId ?? undefined,
      clientId,
      amountArs,
      description,
      payerEmail: client?.email ?? undefined,
      successUrl: `${baseUrl}/cobros?ok=mp-success`,
      failureUrl: `${baseUrl}/cobros?error=mp-failure`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error MP';
    redirect(`/cobros?error=${encodeURIComponent('MP: ' + msg)}`);
  }

  if (!result) {
    redirect(
      '/cobros?error=Mercado+Pago+no+est%C3%A1+configurado+para+esta+cl%C3%ADnica.+Ir+a+Configuraci%C3%B3n+y+pegar+access+token+MP.'
    );
  }

  const { error } = await supabase.from('payments').insert({
    organization_id: orgId,
    client_id: clientId,
    appointment_id: appointmentId,
    amount_ars: amountArs,
    method: 'mp_link',
    status: 'pending',
    mp_preference_id: result.preferenceId,
    mp_payment_link: result.initPoint,
  });

  if (error) redirect(`/cobros?error=${encodeURIComponent(translateDbError(error))}`);

  revalidatePath('/cobros');
  redirect(`/cobros?ok=link-creado`);
}

export async function refundPayment(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/cobros?error=ID+invalido');

  const supabase = createClient();
  const { error } = await supabase
    .from('payments')
    .update({ status: 'refunded' })
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/cobros?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/cobros');
  redirect('/cobros?ok=devuelto');
}
