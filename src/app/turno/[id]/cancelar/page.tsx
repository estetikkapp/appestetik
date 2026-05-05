import { CheckCircle2, Calendar } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SubmitButton } from '@/components/ui/submit-button';
import { cancelAppointmentPublic } from '@/actions/public-cancellation';
import { formatDateTimeAr } from '@/lib/utils/dates';

export const metadata = { title: 'Cancelar turno — appestetika' };

interface Params {
  params: { id: string };
  searchParams: { error?: string; ok?: string };
}

async function loadAppointment(id: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('appointments')
    .select(
      `id, starts_at, status, organization_id,
       organization:organizations(id, name, slug),
       service:services(name)`
    )
    .eq('id', id)
    .maybeSingle();
  return data;
}

export default async function CancelarTurnoPage({ params, searchParams }: Params) {
  const appt = await loadAppointment(params.id);
  const orgRel = appt?.organization;
  const org = Array.isArray(orgRel) ? orgRel[0] : orgRel;
  const svcRel = appt?.service;
  const svc = Array.isArray(svcRel) ? svcRel[0] : svcRel;

  const success = searchParams.ok === 'cancelado';
  const cancelled = appt?.status === 'cancelled';

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        {success || cancelled ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h1 className="mt-4 text-xl font-bold text-stone-900">Turno cancelado</h1>
            <p className="mt-2 text-sm text-stone-600">
              {success
                ? 'Cancelaste correctamente. Si querés reservar otro, andá al centro.'
                : 'Este turno ya estaba cancelado.'}
            </p>
            {org?.slug && (
              <a
                href={`/c/${org.slug}`}
                className="mt-6 inline-block text-sm text-brand-600 hover:underline"
              >
                ← Volver a {org.name}
              </a>
            )}
          </div>
        ) : !appt ? (
          <div className="text-center">
            <h1 className="text-xl font-bold text-stone-900">Turno no encontrado</h1>
            <p className="mt-2 text-sm text-stone-600">
              El link no es válido o el turno fue eliminado.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-start gap-3">
              <Calendar className="mt-1 h-5 w-5 text-brand-500" />
              <div>
                <h1 className="text-lg font-bold text-stone-900">Cancelar turno</h1>
                <p className="mt-1 text-sm text-stone-600">
                  {svc?.name ?? 'Tu turno'} en <strong>{org?.name}</strong>
                  <br />
                  {formatDateTimeAr(appt.starts_at)}
                </p>
              </div>
            </div>

            {searchParams.error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {searchParams.error}
              </div>
            )}

            <form action={cancelAppointmentPublic} className="space-y-4">
              <input type="hidden" name="id" value={appt.id} />

              <div className="space-y-1.5">
                <Label htmlFor="code">Código de 6 dígitos *</Label>
                <Input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  placeholder="000000"
                  className="text-center text-lg tracking-widest tabular-nums"
                />
                <p className="text-xs text-stone-500">
                  Lo recibiste por WhatsApp cuando reservaste.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reason">Motivo de cancelación *</Label>
                <Textarea
                  id="reason"
                  name="reason"
                  required
                  minLength={3}
                  rows={2}
                  placeholder="Ej. surgió un imprevisto"
                />
              </div>

              <SubmitButton variant="destructive" className="w-full" pendingText="Cancelando...">
                Cancelar mi turno
              </SubmitButton>

              <p className="text-center text-xs text-stone-400">
                Para reagendar contactate con el centro.
              </p>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
