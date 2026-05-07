import Link from 'next/link';
import { signup, signInWithGoogle } from '@/actions/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';

export const metadata = { title: 'Crear cuenta — appestetika' };

const ROLE_LABELS: Record<string, string> = {
  admin: 'administradora',
  professional: 'profesional',
  receptionist: 'recepcionista',
};

interface InviteContext {
  token: string;
  email: string;
  orgName: string;
  role: string;
  inviterName: string | null;
}

async function loadInviteContext(
  token: string,
  email: string
): Promise<InviteContext | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('invitations')
    .select(
      `email, role, token, expires_at, accepted_at,
       organizations ( name )`
    )
    .eq('token', token)
    .maybeSingle();

  if (!data) return null;
  if (data.accepted_at) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  if (data.email.toLowerCase() !== email.toLowerCase()) return null;

  const org = Array.isArray(data.organizations) ? data.organizations[0] : data.organizations;

  return {
    token: data.token,
    email: data.email,
    orgName: org?.name ?? 'el centro',
    role: data.role,
    inviterName: null, // sin lookup adicional para mantenerlo simple
  };
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string; invite?: string; email?: string };
}) {
  // Si el query param ?invite= viene, intentar resolver la invitación
  let invite: InviteContext | null = null;
  if (searchParams.invite && searchParams.email) {
    invite = await loadInviteContext(searchParams.invite, searchParams.email);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-brand-700">appestetika</h1>
          {invite ? (
            <p className="mt-2 text-sm text-stone-600">
              Te invitaron a unirte a <strong>{invite.orgName}</strong> como{' '}
              <strong>{ROLE_LABELS[invite.role] ?? invite.role}</strong>.
              <br />
              Creá tu contraseña para empezar.
            </p>
          ) : (
            <p className="mt-1 text-sm text-stone-500">
              Creá tu cuenta gratis · 14 días de prueba
            </p>
          )}
        </div>

        {searchParams.invite && !invite && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <strong>Link de invitación inválido o vencido.</strong> Pedile al
            administrador del centro que te reenvíe la invitación. Mientras tanto,
            podés crear una cuenta nueva (que será de un centro independiente).
          </div>
        )}

        {searchParams.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {searchParams.error}
          </div>
        )}

        <form action={signup} className="space-y-4">
          {/* Pasamos el token al server action — el trigger DB lo lee del raw_user_meta_data */}
          {invite && (
            <input type="hidden" name="invitation_token" value={invite.token} />
          )}

          {/* En signup normal pedimos nombre del centro. En invitación NO — la org ya existe. */}
          {!invite && (
            <div className="space-y-1.5">
              <Label htmlFor="organization_name">Nombre del centro</Label>
              <Input
                id="organization_name"
                name="organization_name"
                required
                placeholder="Ej. Estética Bella"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="full_name">Tu nombre</Label>
            <Input id="full_name" name="full_name" required placeholder="Nombre y apellido" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="tu@email.com"
              defaultValue={invite ? invite.email : ''}
              readOnly={!!invite}
              className={invite ? 'bg-stone-50' : ''}
            />
            {invite && (
              <p className="text-xs text-stone-500">
                Este email lo definió quien te invitó. Si querés usar otro, pedí una
                invitación nueva.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" name="password" type="password" required minLength={8} />
            <p className="text-xs text-stone-500">Mínimo 8 caracteres</p>
          </div>

          <SubmitButton className="w-full" pendingText="Creando cuenta...">
            {invite ? 'Aceptar invitación' : 'Crear cuenta'}
          </SubmitButton>
        </form>

        {/* Google login solo en signup normal — invitaciones requieren email + password
            para que el trigger DB matchee email exacto contra invitations */}
        {!invite && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-stone-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-stone-400">o</span>
              </div>
            </div>

            <form action={signInWithGoogle}>
              <SubmitButton variant="outline" className="w-full" pendingText="Conectando...">
                Continuar con Google
              </SubmitButton>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-stone-500">
          ¿Ya tenés cuenta?{' '}
          <Link href="/auth/login" className="font-medium text-brand-600 hover:underline">
            Iniciá sesión
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-stone-400">
          Al crear una cuenta aceptás nuestros términos de uso y política de privacidad.
        </p>
      </div>
    </main>
  );
}
