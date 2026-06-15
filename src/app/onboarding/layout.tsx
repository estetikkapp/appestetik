import { logout } from '@/actions/auth';
import { SubmitButton } from '@/components/ui/submit-button';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-50">
      <header className="border-b border-brand-100 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-semibold text-brand-700">appestetika</h1>
          <form action={logout}>
            <SubmitButton variant="ghost" size="sm" pendingText="Saliendo...">
              Cerrar sesión
            </SubmitButton>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">{children}</main>
    </div>
  );
}
