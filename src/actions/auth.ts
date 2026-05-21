'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeEmail } from '@/lib/validators/email';
import { notifyAdminNewSignup } from '@/lib/notifications/admin';

export async function login(formData: FormData): Promise<void> {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    redirect('/auth/login?error=Email+y+contrase%C3%B1a+son+obligatorios');
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/auth/login?error=${encodeURIComponent(traducirErrorAuth(error.message))}`);
  }

  redirect('/');
}

export async function signup(formData: FormData): Promise<void> {
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const password = String(formData.get('password') ?? '');
  const organizationName = String(formData.get('organization_name') ?? '').trim();
  const fullName = String(formData.get('full_name') ?? '').trim();
  const invitationToken = String(formData.get('invitation_token') ?? '').trim();

  if (!email || !password) {
    redirect('/auth/signup?error=Email+y+contrase%C3%B1a+son+obligatorios');
  }
  if (password.length < 8) {
    redirect('/auth/signup?error=La+contrase%C3%B1a+debe+tener+al+menos+8+caracteres');
  }

  // Dos paths distintos:
  //
  // 1) Signup por INVITACIÓN: el email ya fue verificado (el invitee abrió el
  //    link en su inbox). Usamos admin.createUser con email_confirm:true para
  //    saltearnos el flujo de confirmación de Supabase Auth (que requiere
  //    SMTP configurado y agrega fricción). Luego lo logueamos directo.
  //
  // 2) Signup NORMAL (free trial, sin invitación): mantenemos signUp() público.
  //    Supabase manda email de confirmación si está configurado; si no, el user
  //    quedará "Email not confirmed" en login. Lo abrimos así por seguridad —
  //    no auto-confirmamos trial accounts (anti-abuso).
  if (invitationToken) {
    await signupFromInvitation({ email, password, fullName, invitationToken });
    return; // signupFromInvitation hace su propio redirect
  }

  // Path 2: signup normal sin invitación
  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      data: {
        full_name: fullName || null,
        organization_name: organizationName || 'Mi centro',
      },
    },
  });

  if (error) {
    redirect(`/auth/signup?error=${encodeURIComponent(traducirErrorAuth(error.message))}`);
  }

  // Notificar al admin (fire-and-forget). No bloquea si falla Resend.
  await notifyAdminNewSignup({
    email,
    fullName: fullName || null,
    isInvitation: false,
    organizationName: organizationName || 'Mi centro',
  });

  // ?fbq_completed_registration=1 lo levanta MetaPixelEventBus en el cliente
  // y dispara fbq('track', 'CompleteRegistration'), después limpia el param.
  redirect('/auth/login?signup=ok&fbq_completed_registration=1');
}

/**
 * Crea usuario con email ya confirmado (porque vino por link de invitación) +
 * lo loguea de una. El trigger DB handle_new_user() lee `invitation_token` del
 * raw_user_meta_data y crea la membership en la org correcta.
 *
 * Si admin.createUser falla (email duplicado, p.ej.), redirigimos al signup
 * con el invite param preservado para que el user vea el contexto.
 */
async function signupFromInvitation(params: {
  email: string;
  password: string;
  fullName: string;
  invitationToken: string;
}): Promise<void> {
  const { email, password, fullName, invitationToken } = params;
  const admin = createAdminClient();

  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName || null,
      invitation_token: invitationToken,
    },
  });

  if (createErr) {
    const errParam = encodeURIComponent(traducirErrorAuth(createErr.message));
    redirect(
      `/auth/signup?invite=${encodeURIComponent(invitationToken)}&email=${encodeURIComponent(email)}&error=${errParam}`
    );
  }

  // Notificar al admin que se sumó alguien por invitación (no bloquea si falla)
  // Buscamos el nombre de la org via el invitation_token
  let orgName: string | null = null;
  try {
    const { data: inv } = await admin
      .from('invitations')
      .select('organization_id, organizations(name)')
      .eq('token', invitationToken)
      .maybeSingle();
    const orgRel = inv?.organizations as { name: string } | { name: string }[] | null | undefined;
    const org = Array.isArray(orgRel) ? orgRel[0] : orgRel;
    orgName = org?.name ?? null;
  } catch {
    // Si falla la query, mandamos la notif igual sin el orgName
  }
  await notifyAdminNewSignup({
    email,
    fullName: fullName || null,
    isInvitation: true,
    organizationName: orgName,
  });

  // Auto-login con el cliente que escribe cookies de sesión
  const supabase = createClient();
  const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });

  if (loginErr) {
    // Caso raro: usuario creado pero login falló (ej. trigger falló por race
    // condition). El user puede loguear manualmente — su cuenta ya existe.
    redirect('/auth/login?signup=ok&fbq_completed_registration=1');
  }

  // Middleware decide: si onboarded → /, si no → /waiting-setup o /onboarding.
  // Track CompleteRegistration en la pantalla destino (invitado = nuevo user
  // creado igual). Para invitados NO sale StartTrial — eso es solo cuando
  // crean su propia org desde el signup público y eligen plan.
  redirect('/?fbq_completed_registration=1');
}

export async function logout(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/auth/login');
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/auth/login?error=${encodeURIComponent(traducirErrorAuth(error.message))}`);
  }

  if (data.url) {
    redirect(data.url);
  }

  redirect('/auth/login?error=No+se+pudo+iniciar+sesi%C3%B3n+con+Google');
}

function traducirErrorAuth(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Email o contraseña inválidos';
  if (msg.includes('already registered')) return 'Ese email ya está registrado';
  if (msg.includes('User not found')) return 'No existe una cuenta con ese email';
  if (msg.includes('Email not confirmed')) return 'Todavía no confirmaste tu email';
  if (msg.includes('rate limit')) return 'Demasiados intentos, esperá un momento';
  return msg;
}
