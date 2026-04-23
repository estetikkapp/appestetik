import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/sidebar';
import { UserMenu } from '@/components/layout/user-menu';
import { OrgSwitcher } from '@/components/layout/org-switcher';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const activeOrgId = cookies().get('active_org')?.value;

  // Cargar memberships + display_name del user actual
  const { data: memberships } = await supabase
    .from('memberships')
    .select('organization_id, role, display_name, organizations(id, name)')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: false });

  const activeMembership = memberships?.find((m) => m.organization_id === activeOrgId);

  const orgs: Array<{ id: string; name: string; role: string }> = [];
  for (const m of memberships ?? []) {
    const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
    if (org) orgs.push({ id: org.id, name: org.name, role: m.role });
  }

  return (
    <div className="flex min-h-screen bg-brand-50/30">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3">
          <OrgSwitcher orgs={orgs} activeOrgId={activeOrgId ?? ''} />
          <UserMenu
            email={user.email ?? ''}
            displayName={activeMembership?.display_name ?? null}
          />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
