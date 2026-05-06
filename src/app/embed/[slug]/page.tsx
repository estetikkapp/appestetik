import { notFound } from 'next/navigation';
import { Clock, DollarSign } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatArs } from '@/lib/utils/format-ars';
import { BookingForm } from '@/app/c/[slug]/booking-form';

interface Params {
  params: { slug: string };
  searchParams: { error?: string; service?: string; waitlisted?: string };
}

async function loadCenter(slug: string) {
  const supabase = createAdminClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, timezone')
    .eq('slug', slug)
    .not('onboarded_at', 'is', null)
    .maybeSingle();
  if (!org) return null;

  const [servicesResult, profsResult, proServicesResult] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, category, description, duration_minutes, price_ars')
      .eq('organization_id', org.id)
      .eq('active', true)
      .order('name'),
    supabase
      .from('memberships')
      .select('id, display_name, role, schedule_template_id')
      .eq('organization_id', org.id)
      .eq('active', true)
      .in('role', ['owner', 'admin', 'professional'])
      .not('schedule_template_id', 'is', null),
    supabase
      .from('professional_services')
      .select('membership_id, service_id')
      .eq('organization_id', org.id),
  ]);

  return {
    org,
    services: servicesResult.data ?? [],
    professionals: profsResult.data ?? [],
    proServices: proServicesResult.data ?? [],
  };
}

/**
 * Widget embebible. Mismo flow de reserva que /c/[slug] pero con chrome
 * minimal — pensado para iframe en bio link de Instagram, sitio del centro, etc.
 */
export default async function EmbedReservationPage({ params, searchParams }: Params) {
  const data = await loadCenter(params.slug);
  if (!data) notFound();

  const { org, services, professionals, proServices } = data;
  const selectedServiceId = searchParams.service;
  const selectedService = services.find((s) => s.id === selectedServiceId);

  const profsWithExplicitServices = new Set(proServices.map((ps) => ps.membership_id));
  const profsForService = selectedService
    ? professionals.filter((p) => {
        if (profsWithExplicitServices.has(p.id)) {
          return proServices.some(
            (ps) => ps.membership_id === p.id && ps.service_id === selectedService.id
          );
        }
        return true;
      })
    : [];

  return (
    <main className="mx-auto max-w-2xl p-4">
      {searchParams.error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}
      {searchParams.waitlisted === '1' && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          ¡Listo! Te sumamos a la lista de espera. Te avisamos por WhatsApp.
        </div>
      )}

      {!selectedService ? (
        <section>
          <h2 className="mb-3 text-base font-semibold text-stone-900">
            Elegí un servicio en {org.name}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {services.length === 0 && (
              <p className="text-sm text-stone-500">No hay servicios disponibles.</p>
            )}
            {services.map((s) => (
              <a
                key={s.id}
                href={`/embed/${params.slug}?service=${s.id}`}
                className="group rounded-xl border border-stone-200 bg-white p-3 transition-colors hover:border-brand-300"
              >
                <h3 className="text-sm font-medium text-stone-900 group-hover:text-brand-700">
                  {s.name}
                </h3>
                {s.category && (
                  <p className="text-[10px] uppercase tracking-wide text-stone-400">
                    {s.category}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3 text-xs text-stone-700">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {s.duration_minutes}min
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <DollarSign className="h-3 w-3" />
                    {formatArs(Number(s.price_ars))}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      ) : (
        <section>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-stone-900">{selectedService.name}</h2>
              <div className="mt-0.5 flex gap-2 text-xs text-stone-600">
                <span>{selectedService.duration_minutes} min</span>
                <span>·</span>
                <span className="font-medium">{formatArs(Number(selectedService.price_ars))}</span>
              </div>
            </div>
            <a
              href={`/embed/${params.slug}`}
              className="text-xs text-brand-600 hover:underline"
            >
              Cambiar
            </a>
          </div>

          {profsForService.length === 0 ? (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-center text-xs text-stone-500">
              Este servicio no está disponible para reserva online.
            </div>
          ) : (
            <BookingForm
              slug={params.slug}
              serviceId={selectedService.id}
              serviceName={selectedService.name}
              durationMinutes={selectedService.duration_minutes}
              professionals={profsForService.map((p) => ({
                id: p.id,
                display_name: p.display_name,
              }))}
              isEmbed
            />
          )}
        </section>
      )}

      <p className="mt-6 text-center text-[10px] text-stone-400">
        Potenciado por <span className="font-semibold text-brand-600">appestetika</span>
      </p>
    </main>
  );
}
