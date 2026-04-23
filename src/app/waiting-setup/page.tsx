import { logout } from '@/actions/auth';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Esperando configuración — appestetika' };

export default function WaitingSetupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-brand-700">Tu centro se está configurando</h1>
        <p className="mt-3 text-sm text-stone-600">
          El/la owner de tu organización todavía no completó el onboarding. Contactate con quien te
          invitó para que termine de configurar el centro. Cuando esté listo, vas a poder ingresar.
        </p>
        <form action={logout} className="mt-6">
          <Button type="submit" variant="outline" className="w-full">
            Cerrar sesión
          </Button>
        </form>
      </div>
    </main>
  );
}
