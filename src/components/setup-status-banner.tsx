/**
 * Banner que detecta si la org tiene servicios pero no puede tomar reservas
 * online porque no hay profesionales con plantilla de horarios asignada.
 *
 * Se renderiza en /servicios y /agenda. Server component — no depende del user.
 */

import Link from 'next/link';
import { cookies } from 'next/headers';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export async function SetupStatusBanner() {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return null;

  const [servicesResult, eligibleProsResult, templatesResult] = await Promise.all([
    supabase
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('active', true),
    supabase
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('active', true)
      .in('role', ['owner', 'admin', 'professional'])
      .not('schedule_template_id', 'is', null),
    supabase
      .from('schedule_templates')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('active', true),
  ]);

  const serviceCount = servicesResult.count ?? 0;
  const eligibleProsCount = eligibleProsResult.count ?? 0;
  const templateCount = templatesResult.count ?? 0;

  // No hay nada que avisar
  if (serviceCount === 0) return null;
  if (eligibleProsCount > 0) return null;

  // Hay servicios pero ningún profesional puede atenderlos online
  const noTemplate = templateCount === 0;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-semibold text-amber-900">
            Tu reserva pública está vacía — falta asignar horarios a profesionales
          </p>
          <p className="text-xs text-amber-800">
            Tenés <strong>{serviceCount} servicio{serviceCount === 1 ? '' : 's'}</strong> activo
            {serviceCount === 1 ? '' : 's'}, pero ningún profesional con plantilla de horarios.
            Las clientas no pueden reservar online hasta que termines el setup:
          </p>
          <ol className="ml-4 list-decimal space-y-1 text-xs text-amber-800">
            {noTemplate && (
              <li>
                Crear una plantilla de horarios →{' '}
                <Link
                  href="/horarios"
                  className="font-medium underline hover:text-amber-900"
                >
                  Ir a Horarios
                </Link>
              </li>
            )}
            <li>
              Asignar la plantilla a un profesional (incluido vos como owner) →{' '}
              <Link
                href="/empleadas"
                className="font-medium underline hover:text-amber-900"
              >
                Ir a Empleadas
              </Link>{' '}
              y click en el icono de configuración
            </li>
            <li>
              <em>Opcional:</em> en la misma vista de Empleadas, asignar qué servicios
              ofrece cada profesional. Si no asignás nada, ofrece todos por defecto.
            </li>
          </ol>
        </div>
        <Link
          href="/horarios"
          className="hidden shrink-0 items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 sm:inline-flex"
        >
          Empezar
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
