import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';
import { UserMenu } from '@/components/layout/user-menu';
import { OrgSwitcher } from '@/components/layout/org-switcher';
import { NotificationsBell } from '@/components/notifications/notifications-bell';
import { WelcomeTour } from '@/components/onboarding/welcome-tour';
import { HelpChatWidget } from '@/components/help-chat/help-chat-widget';
import type { Role } from '@/lib/auth/require-membership';
import { getOrgFeatureContext } from '@/lib/plans/subscription-service';
import { planHasFeature } from '@/lib/plans/feature-flags';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const activeOrgId = cookies().get('active_org')?.value;

  // Cargar memberships + display_name del user actual + tour_completed_at
  // (este último lo usamos para decidir si arranca el welcome tour)
  const { data: memberships } = await supabase
    .from('memberships')
    .select('organization_id, role, display_name, tour_completed_at, organizations(id, name)')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: false });

  const activeMembership = memberships?.find((m) => m.organization_id === activeOrgId);

  const orgs: Array<{ id: string; name: string; role: string }> = [];
  for (const m of memberships ?? []) {
    const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
    if (org) orgs.push({ id: org.id, name: org.name, role: m.role });
  }

  // Si no hay activeMembership (caso raro: cookie stale), default a
  // 'professional' (rol mínimo seguro) para que el Sidebar no muestre admin
  // tools. El middleware ya valida sesión + membership antes de llegar acá.
  const activeRole = (activeMembership?.role ?? 'professional') as Role;

  // Welcome tour: solo lo mostramos a la dueña (owner) que todavía no lo
  // completó. Decisión 1A del owner del producto.
  const showTour = activeRole === 'owner' && !activeMembership?.tour_completed_at;

  // Cargamos plan + grandfathered SIEMPRE (no solo para el tour) para
  // pasárselo al Sidebar y que filtre links por feature, no solo por rol.
  // Si falla, defaults seguros que no rompan UX (sin filtrado por plan).
  let planContext: { planId: 'gabinete' | 'equipo' | 'centro'; isGrandfathered: boolean } | undefined;
  let tourHasEmpleados = false;
  if (activeOrgId) {
    try {
      const { subscription, isGrandfathered } = await getOrgFeatureContext(activeOrgId);
      if (subscription) {
        planContext = {
          planId: subscription.plan_id,
          isGrandfathered,
        };
        tourHasEmpleados = planHasFeature(subscription.plan_id, 'multi_usuario') || isGrandfathered;
      }
    } catch {
      // sin sub o error → no filtramos por plan (compatibility safe)
    }
  }

  return (
    <div className="flex min-h-screen bg-brand-50/30">
      <Sidebar role={activeRole} planContext={planContext} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3">
          <OrgSwitcher orgs={orgs} activeOrgId={activeOrgId ?? ''} />
          <div className="flex items-center gap-2">
            <NotificationsBell userId={user.id} />
            <UserMenu
              email={user.email ?? ''}
              displayName={activeMembership?.display_name ?? null}
            />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
      <WelcomeTour enabled={showTour} hasEmpleados={tourHasEmpleados} />
      <HelpChatWidget />
    </div>
  );
}
