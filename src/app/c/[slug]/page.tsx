import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Clock, DollarSign } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatArs } from '@/lib/utils/format-ars';
import { BookingForm } from './booking-form';

interface Params {
  params: { slug: string };
  searchParams: { error?: string; service?: string; waitlisted?: string };
}

async function loadCenter(slug: string) {
  const supabase = createAdminClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, logo_url, timezone')
    .eq('slug', slug)
    .not('onboarded_at', 'is', null)
    .maybeSingle();
  if (!org) return null;

  const [servicesResult, hoursResult, profsResult, proServicesResult] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, category, description, duration_minutes, price_ars')
      .eq('organization_id', org.id)
      .eq('active', true)
      .order('name'),
    supabase
      .from('business_hours')
      .select('day_of_week, opens_at, closes_at, active')
      .eq('organization_id', org.id),
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
    hours: hoursResult.data ?? [],
    professionals: profsResult.data ?? [],
    proServices: proServicesResult.data ?? [],
  };
}

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default async function PublicReservationPage({ params, searchParams }: Params) {
  const data = await loadCenter(params.slug);
  if (!data) notFound();

  const { org, services, hours, professionals, proServices } = data;
  const selectedServiceId = searchParams.service;
  const selectedService = services.find((s) => s.id === selectedServiceId);

  // Profesionales que ofrecen este servicio
  const profsWithExplicitServices = new Set(proServices.map((ps) => ps.membership_id));
  const profsForService = selectedService
    ? professionals.filter((p) => {
        if (profsWithExplicitServices.has(p.id)) {
          return proServices.some(
            (ps) => ps.membership_id === p.id && ps.service_id === selectedService.id
          );
        }
        return true; // sin servicios explícitos = ofrece todos
      })
    : [];

  const orderedHours = [1, 2, 3, 4, 5, 6, 0].map((d) => hours.find((h) => h.day_of_week === d));

  return (
    <main className="min-h-screen bg-brand-50">
      <header className="border-b border-brand-100 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-6">
          {org.logo_url && (
            <Image
              src={org.logo_url}
              alt={org.name}
              width={48}
              height={48}
              className="h-12 w-12 rounded-full object-cover"
              unoptimized
              priority
            />
          )}
          <div>
            <h1 className="text-xl font-bold text-stone-900">{org.name}</h1>
            <p className="text-xs text-stone-500">Reservá tu turno online</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        {searchParams.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {searchParams.error}
          </div>
        )}
        {searchParams.waitlisted === '1' && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            ¡Listo! Te sumamos a la lista de espera. Te avisamos por WhatsApp cuando se libere un turno.
          </div>
        )}

        {!selectedService ? (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-stone-900">Elegí un servicio</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {services.length === 0 && (
                <p className="text-sm text-stone-500">
                  Todavía no hay servicios disponibles. Volvé pronto.
                </p>
              )}
              {services.map((s) => (
                <a
                  key={s.id}
                  href={`/c/${params.slug}?service=${s.id}`}
                  className="group rounded-2xl border border-stone-200 bg-white p-4 transition-colors hover:border-brand-300"
                >
                  <h3 className="font-medium text-stone-900 group-hover:text-brand-700">
                    {s.name}
                  </h3>
                  {s.category && (
                    <p className="mt-0.5 text-xs uppercase tracking-wide text-stone-400">
                      {s.category}
                    </p>
                  )}
                  {s.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-stone-600">{s.description}</p>
                  )}
                  <div className="mt-3 flex items-center gap-4 text-sm text-stone-700">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" /> {s.duration_minutes} min
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <DollarSign className="h-4 w-4" />
                      {formatArs(Number(s.price_ars))}
                    </span>
                  </div>
                </a>
              ))}
            </div>

            <section className="mt-10 rounded-2xl border border-stone-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-stone-900">Horarios de atención</h3>
              <dl className="grid gap-1 text-sm">
                {orderedHours.map((h, idx) => {
                  const dayIdx = [1, 2, 3, 4, 5, 6, 0][idx];
                  return (
                    <div key={idx} className="flex justify-between">
                      <dt className="text-stone-600">{DAY_LABELS[dayIdx!]}</dt>
                      <dd className="text-stone-800">
                        {h?.active
                          ? `${h.opens_at?.slice(0, 5)} — ${h.closes_at?.slice(0, 5)}`
                          : 'Cerrado'}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          </section>
        ) : (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-stone-900">{selectedService.name}</h2>
                <div className="mt-1 flex gap-3 text-sm text-stone-600">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" /> {selectedService.duration_minutes} min
                  </span>
                  <span className="font-medium">{formatArs(Number(selectedService.price_ars))}</span>
                </div>
              </div>
              <a href={`/c/${params.slug}`} className="text-sm text-brand-600 hover:underline">
                Cambiar
              </a>
            </div>

            {profsForService.length === 0 ? (
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-500">
                Este servicio no está disponible para reserva online (no hay profesionales con
                horarios configurados que lo ofrezcan).
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
              />
            )}
          </section>
        )}

        <footer className="pt-8 text-center text-xs text-stone-400">
          Potenciado por <span className="font-semibold text-brand-600">appestetika</span>
        </footer>
      </div>
    </main>
  );
}
