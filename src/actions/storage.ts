'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_LOGO_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

export async function uploadOrganizationLogo(formData: FormData): Promise<void> {
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) redirect('/auth/login');

  const file = formData.get('logo');
  if (!file || !(file instanceof File) || file.size === 0) {
    redirect('/configuracion?error=No+hay+archivo+seleccionado');
  }

  if (!ALLOWED_LOGO_MIME.includes(file.type)) {
    redirect('/configuracion?error=Formato+no+soportado+%28png%2C+jpg%2C+webp%2C+svg%29');
  }

  if (file.size > MAX_LOGO_BYTES) {
    redirect('/configuracion?error=El+archivo+supera+5MB');
  }

  const supabase = createClient();

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
  const path = `${orgId}/logo.${ext}`;

  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('organization-logos')
    .upload(path, new Uint8Array(arrayBuffer), {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    redirect(`/configuracion?error=${encodeURIComponent(uploadError.message)}`);
  }

  // URL firmada para guardar en la org (valida 10 años básicamente)
  const { data: signed } = await supabase.storage
    .from('organization-logos')
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);

  if (signed?.signedUrl) {
    await supabase
      .from('organizations')
      .update({ logo_url: signed.signedUrl })
      .eq('id', orgId);
  }

  revalidatePath('/configuracion');
  revalidatePath('/', 'layout');
  redirect('/configuracion?ok=logo-subido');
}
