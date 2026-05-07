'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { normalizeEmail } from '@/lib/validators/email';

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

  // Si tenemos invitation_token, lo pasamos en metadata. El trigger DB
  // handle_new_user() lo lee y crea membership en la org de la invitación
  // (en vez de crear org nueva).
  const userData: Record<string, string | null> = {
    full_name: fullName || null,
  };
  if (invitationToken) {
    userData.invitation_token = invitationToken;
  } else {
    userData.organization_name = organizationName || 'Mi centro';
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      data: userData,
    },
  });

  if (error) {
    const errParam = encodeURIComponent(traducirErrorAuth(error.message));
    if (invitationToken) {
      // Preservar el invite param para que signup recupere el contexto
      redirect(
        `/auth/signup?invite=${encodeURIComponent(invitationToken)}&email=${encodeURIComponent(email)}&error=${errParam}`
      );
    }
    redirect(`/auth/signup?error=${errParam}`);
  }

  redirect('/auth/login?signup=ok');
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
