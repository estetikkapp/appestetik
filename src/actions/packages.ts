'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { translateDbError } from '@/lib/utils/db-errors';

async function getActiveOrgOrRedirect(): Promise<string> {
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) redirect('/auth/login');
  return orgId;
}

export async function createPackage(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const serviceId = String(formData.get('service_id') ?? '').trim() || null;
  const sessionsTotal = Number(formData.get('sessions_total') ?? 0);
  const validityDays = Number(formData.get('validity_days') ?? 365);
  const priceArs = Number(formData.get('price_ars') ?? 0);
  const discount = Number(formData.get('discount_percentage') ?? 0);

  if (!name) redirect('/paquetes?error=Nombre+requerido');
  if (sessionsTotal < 1) redirect('/paquetes?error=Sesiones+inv%C3%A1lidas');
  if (priceArs < 0) redirect('/paquetes?error=Precio+inv%C3%A1lido');

  const supabase = createClient();
  const { error } = await supabase.from('packages').insert({
    organization_id: orgId,
    name,
    description,
    service_id: serviceId,
    sessions_total: sessionsTotal,
    validity_days: validityDays,
    price_ars: priceArs,
    discount_percentage: discount,
  });

  if (error) redirect(`/paquetes?error=${encodeURIComponent(translateDbError(error))}`);

  revalidatePath('/paquetes');
  redirect('/paquetes?ok=creado');
}

export async function updatePackage(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/paquetes?error=ID+invalido');

  const supabase = createClient();
  const { error } = await supabase
    .from('packages')
    .update({
      name: String(formData.get('name') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim() || null,
      service_id: String(formData.get('service_id') ?? '').trim() || null,
      sessions_total: Number(formData.get('sessions_total') ?? 0),
      validity_days: Number(formData.get('validity_days') ?? 365),
      price_ars: Number(formData.get('price_ars') ?? 0),
      discount_percentage: Number(formData.get('discount_percentage') ?? 0),
    })
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/paquetes?error=${encodeURIComponent(translateDbError(error))}`);

  revalidatePath('/paquetes');
  redirect('/paquetes?ok=actualizado');
}

export async function togglePackageActive(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  const active = formData.get('active') === 'true';

  const supabase = createClient();
  const { error } = await supabase
    .from('packages')
    .update({ active: !active })
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/paquetes?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/paquetes');
  redirect('/paquetes');
}

export async function deletePackage(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/paquetes?error=ID+invalido');

  const supabase = createClient();
  const { error } = await supabase
    .from('packages')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) redirect(`/paquetes?error=${encodeURIComponent(translateDbError(error))}`);
  revalidatePath('/paquetes');
  redirect('/paquetes?ok=eliminado');
}

export async function assignPackageToClient(formData: FormData): Promise<void> {
  const orgId = await getActiveOrgOrRedirect();
  const clientId = String(formData.get('client_id') ?? '');
  const packageId = String(formData.get('package_id') ?? '');

  if (!clientId || !packageId) {
    redirect('/paquetes?error=Datos+invalidos');
  }

  const supabase = createClient();
  const { data: pkg } = await supabase
    .from('packages')
    .select('sessions_total, validity_days, price_ars, discount_percentage')
    .eq('id', packageId)
    .eq('organization_id', orgId)
    .single();

  if (!pkg) redirect('/paquetes?error=Paquete+no+encontrado');

  const expiresAt = new Date(Date.now() + pkg.validity_days * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('client_packages').insert({
    organization_id: orgId,
    client_id: clientId,
    package_id: packageId,
    sessions_remaining: pkg.sessions_total,
    expires_at: expiresAt,
    purchase_price_ars: pkg.price_ars,
  });

  if (error) redirect(`/paquetes?error=${encodeURIComponent(translateDbError(error))}`);

  revalidatePath(`/clientas/${clientId}`);
  revalidatePath('/paquetes');
  redirect(`/clientas/${clientId}?ok=paquete-asignado&tab=packages`);
}
