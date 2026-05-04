import Link from 'next/link';
import { signup, signInWithGoogle } from '@/actions/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';

export const metadata = { title: 'Crear cuenta — appestetika' };

export default function SignupPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-brand-700">appestetika</h1>
          <p className="mt-1 text-sm text-stone-500">Creá tu cuenta gratis · 14 días de prueba</p>
        </div>

        {searchParams.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {searchParams.error}
          </div>
        )}

        <form action={signup} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="organization_name">Nombre del centro</Label>
            <Input
              id="organization_name"
              name="organization_name"
              required
              placeholder="Ej. Estética Bella"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Tu nombre</Label>
            <Input id="full_name" name="full_name" required placeholder="Nombre y apellido" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required placeholder="tu@email.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" name="password" type="password" required minLength={8} />
            <p className="text-xs text-stone-500">Mínimo 8 caracteres</p>
          </div>
          <SubmitButton className="w-full" pendingText="Creando cuenta...">
            Crear cuenta
          </SubmitButton>
        </form>

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
