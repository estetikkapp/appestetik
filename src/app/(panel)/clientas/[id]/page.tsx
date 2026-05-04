import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { ArrowLeft, Phone, Mail, IdCard, Cake, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SubmitButton } from '@/components/ui/submit-button';
import { formatPhoneDisplay } from '@/lib/utils/format-phone';
import { formatDateAr, formatDateTimeAr } from '@/lib/utils/dates';
import { formatArs } from '@/lib/utils/format-ars';
import { upsertMedicalInfo } from '@/actions/medical-info';
import { SignaturePad } from '@/components/clientas/signature-pad';
import { TreatmentSessionForm } from '@/components/clientas/treatment-session-form';
import { TreatmentSessionRow } from '@/components/clientas/treatment-session-row';
import { AssignPackageForm } from '@/components/clientas/assign-package-form';

export const metadata = { title: 'Ficha clínica — appestetika' };

async function loadClientData(id: string) {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return null;

  const [
    clientResult,
    medicalResult,
    sessionsResult,
    packagesResult,
    appointmentsResult,
    servicesResult,
    availablePackagesResult,
  ] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).eq('organization_id', orgId).maybeSingle(),
    supabase.from('client_medical_info').select('*').eq('client_id', id).maybeSingle(),
    supabase
      .from('treatment_sessions')
      .select('*, service:services(name)')
      .eq('client_id', id)
      .order('performed_at', { ascending: false })
      .limit(50),
    supabase
      .from('client_packages')
      .select('*, package:packages(name, sessions_total)')
      .eq('client_id', id)
      .eq('status', 'active')
      .order('expires_at'),
    supabase
      .from('appointments')
      .select('id, starts_at, status, service:services(name)')
      .eq('client_id', id)
      .order('starts_at', { ascending: false })
      .limit(20),
    supabase
      .from('services')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('name'),
    supabase
      .from('packages')
      .select('id, name, sessions_total, price_ars')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('name'),
  ]);

  if (!clientResult.data) return null;

  return {
    client: clientResult.data,
    medical: medicalResult.data,
    sessions: sessionsResult.data ?? [],
    packages: packagesResult.data ?? [],
    appointments: appointmentsResult.data ?? [],
    services: servicesResult.data ?? [],
    availablePackages: availablePackagesResult.data ?? [],
  };
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string; ok?: string; error?: string };
}) {
  const data = await loadClientData(params.id);
  if (!data) notFound();
  const { client, medical, sessions, packages, appointments, services, availablePackages } = data;

  const tab = searchParams.tab ?? 'info';
  const okMessages: Record<string, string> = {
    'info-medica-guardada': 'Información médica guardada.',
    'consent-firmado': 'Consentimiento firmado y guardado.',
    'sesion-creada': 'Sesión registrada.',
    'sesion-eliminada': 'Sesión eliminada.',
  };

  const hasContraindication = !!(
    medical?.contraindications ||
    medical?.allergies ||
    (medical?.pregnancy_status && medical.pregnancy_status !== 'no')
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/clientas">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-stone-900">{client.full_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-stone-500">
              {client.phone_e164 && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {formatPhoneDisplay(client.phone_e164)}
                </span>
              )}
              {client.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {client.email}
                </span>
              )}
              {client.dni && (
                <span className="inline-flex items-center gap-1">
                  <IdCard className="h-3.5 w-3.5" />
                  {client.dni}
                </span>
              )}
              {client.birthdate && (
                <span className="inline-flex items-center gap-1">
                  <Cake className="h-3.5 w-3.5" />
                  {formatDateAr(client.birthdate)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {hasContraindication && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <strong>⚠ Atención:</strong> esta clienta tiene{' '}
          {medical?.allergies && <span>alergias declaradas, </span>}
          {medical?.contraindications && <span>contraindicaciones, </span>}
          {medical?.pregnancy_status === 'si' && <span>embarazo en curso, </span>}
          {medical?.pregnancy_status === 'lactancia' && <span>está en lactancia, </span>}
          revisá la pestaña <strong>Datos médicos</strong> antes del tratamiento.
        </div>
      )}

      {searchParams.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}
      {searchParams.ok && okMessages[searchParams.ok] && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {okMessages[searchParams.ok]}
        </div>
      )}

      <nav className="flex gap-2 border-b border-stone-200">
        {[
          { id: 'info', label: 'Datos médicos' },
          { id: 'sessions', label: `Sesiones (${sessions.length})` },
          { id: 'packages', label: `Paquetes (${packages.length})` },
          { id: 'appointments', label: `Turnos (${appointments.length})` },
          { id: 'consent', label: 'Consentimiento' },
        ].map((t) => (
          <Link
            key={t.id}
            href={`/clientas/${client.id}?tab=${t.id}`}
            className={`border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === t.id
                ? 'border-brand-500 font-medium text-brand-700'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === 'info' && (
        <section className="rounded-xl border border-stone-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Datos médicos</h2>
          <form action={upsertMedicalInfo} className="space-y-4">
            <input type="hidden" name="client_id" value={client.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pregnancy_status">Estado de embarazo</Label>
                <select
                  id="pregnancy_status"
                  name="pregnancy_status"
                  defaultValue={medical?.pregnancy_status ?? ''}
                  className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <option value="">No declarado</option>
                  <option value="no">No</option>
                  <option value="si">Sí, embarazada</option>
                  <option value="lactancia">En lactancia</option>
                  <option value="trying">Buscando embarazo</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="skin_type">Fototipo (Fitzpatrick)</Label>
                <select
                  id="skin_type"
                  name="skin_type"
                  defaultValue={medical?.skin_type ?? ''}
                  className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <option value="">No determinado</option>
                  <option value="I">I — muy clara, siempre se quema</option>
                  <option value="II">II — clara, se quema fácil</option>
                  <option value="III">III — clara/morena, se quema y broncea</option>
                  <option value="IV">IV — morena, raramente se quema</option>
                  <option value="V">V — morena oscura</option>
                  <option value="VI">VI — negra</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="allergies">Alergias conocidas</Label>
              <Textarea
                id="allergies"
                name="allergies"
                defaultValue={medical?.allergies ?? ''}
                rows={2}
                placeholder="Ej. Lidocaína, fragancias, látex"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="medications">Medicaciones actuales</Label>
              <Textarea
                id="medications"
                name="medications"
                defaultValue={medical?.medications ?? ''}
                rows={2}
                placeholder="Ej. Isotretinoína (últimos 6 meses)"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contraindications">Contraindicaciones</Label>
              <Textarea
                id="contraindications"
                name="contraindications"
                defaultValue={medical?.contraindications ?? ''}
                rows={3}
                placeholder="Ej. Marcapasos, epilepsia, herpes activo"
              />
            </div>

            <div className="flex justify-end pt-2">
              <SubmitButton pendingText="Guardando...">
                <Pencil className="mr-2 h-4 w-4" />
                Guardar datos médicos
              </SubmitButton>
            </div>
          </form>
        </section>
      )}

      {tab === 'sessions' && (
        <div className="space-y-4">
          <section className="rounded-xl border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Nueva sesión</h2>
            <TreatmentSessionForm clientId={client.id} services={services} />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Historial de sesiones</h2>
            {sessions.length === 0 && (
              <p className="text-sm text-stone-400">No hay sesiones registradas.</p>
            )}
            {sessions.map((s) => (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <TreatmentSessionRow key={s.id} session={s as any} clientId={client.id} />
            ))}
          </section>
        </div>
      )}

      {tab === 'packages' && (
        <div className="space-y-4">
          {availablePackages.length > 0 && (
            <section className="rounded-xl border border-stone-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold">Asignar nuevo paquete</h2>
              <AssignPackageForm clientId={client.id} availablePackages={availablePackages} />
            </section>
          )}
          <section className="rounded-xl border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Paquetes activos</h2>
            {packages.length === 0 ? (
              <p className="text-sm text-stone-500">
                Esta clienta no tiene paquetes activos.{' '}
                <Link href="/paquetes" className="text-brand-600 hover:underline">
                  Crear paquetes
                </Link>{' '}
                primero.
              </p>
            ) : (
              <ul className="space-y-3">
                {packages.map((p) => {
                  const pkgRel = Array.isArray(p.package) ? p.package[0] : p.package;
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-stone-100 p-3"
                    >
                      <div>
                        <div className="font-medium">{pkgRel?.name}</div>
                        <p className="text-xs text-stone-500">
                          {p.sessions_remaining} de {pkgRel?.sessions_total ?? '—'} sesiones · vence{' '}
                          {formatDateAr(p.expires_at)}
                        </p>
                      </div>
                      <Badge variant="success">{formatArs(Number(p.purchase_price_ars))}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === 'appointments' && (
        <section className="rounded-xl border border-stone-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Historial de turnos</h2>
          {appointments.length === 0 ? (
            <p className="text-sm text-stone-500">Sin turnos registrados.</p>
          ) : (
            <ul className="space-y-2">
              {appointments.map((a) => {
                const svc = Array.isArray(a.service) ? a.service[0] : a.service;
                return (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-stone-100 p-3 text-sm"
                  >
                    <div>
                      <div className="font-medium">{svc?.name ?? 'Sin servicio'}</div>
                      <div className="text-xs text-stone-500">{formatDateTimeAr(a.starts_at)}</div>
                    </div>
                    <Badge variant={a.status === 'completed' ? 'success' : 'secondary'}>
                      {a.status}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {tab === 'consent' && (
        <section className="rounded-xl border border-stone-200 bg-white p-6">
          <h2 className="mb-2 text-lg font-semibold">Consentimiento informado</h2>
          <p className="mb-4 text-sm text-stone-500">
            La clienta debe firmar antes de la primera sesión de láser, peeling, dermapen o
            tratamientos invasivos. La firma queda guardada en el sistema.
          </p>
          <SignaturePad
            clientId={client.id}
            alreadySignedAt={medical?.consent_signed_at ?? null}
          />
          {medical?.consent_signature_url && (
            <div className="mt-4 rounded-lg border border-stone-200 p-3">
              <p className="mb-2 text-xs font-medium text-stone-500">Última firma registrada:</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={medical.consent_signature_url}
                alt="Firma anterior"
                className="max-h-40 rounded border border-stone-200"
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
