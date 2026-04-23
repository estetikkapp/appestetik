'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { switchActiveOrg } from '@/actions/memberships';

interface OrgOption {
  id: string;
  name: string;
  role: string;
}

interface OrgSwitcherProps {
  orgs: OrgOption[];
  activeOrgId: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  professional: 'Profesional',
  receptionist: 'Recepción',
};

export function OrgSwitcher({ orgs, activeOrgId }: OrgSwitcherProps) {
  const active = orgs.find((o) => o.id === activeOrgId);

  if (orgs.length <= 1) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-1.5 text-sm">
        <span className="font-medium text-stone-900">{active?.name ?? 'Sin organización'}</span>
        {active && (
          <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs text-brand-700">
            {ROLE_LABELS[active.role] ?? active.role}
          </span>
        )}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-1.5 text-sm hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <span className="font-medium text-stone-900">{active?.name ?? 'Sin organización'}</span>
        {active && (
          <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs text-brand-700">
            {ROLE_LABELS[active.role] ?? active.role}
          </span>
        )}
        <ChevronsUpDown className="h-4 w-4 text-stone-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs text-stone-500">Tus organizaciones</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {orgs.map((org) => (
          <form key={org.id} action={switchActiveOrg}>
            <input type="hidden" name="org_id" value={org.id} />
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full justify-between">
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">{org.name}</span>
                  <span className="text-xs text-stone-500">
                    {ROLE_LABELS[org.role] ?? org.role}
                  </span>
                </div>
                {org.id === activeOrgId && <Check className="h-4 w-4 text-brand-600" />}
              </button>
            </DropdownMenuItem>
          </form>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
