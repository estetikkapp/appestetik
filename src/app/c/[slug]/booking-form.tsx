'use client';

import { useState, useEffect, useTransition } from 'react';
import { Loader2, Clock as ClockIcon, Bell } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SubmitButton } from '@/components/ui/submit-button';
import { createPublicReservation } from '@/actions/public-booking';
import { addToWaitlistPublic } from '@/actions/public-waitlist';

interface ProfessionalOption {
  id: string; // membership id
  display_name: string | null;
}

interface SlotData {
  professional_id: string;
  display_name: string | null;
  slots: string[];
}

interface BookingFormProps {
  slug: string;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  professionals: ProfessionalOption[];
  /** Si true, redirige a /embed/[slug] en vez de /c/[slug] tras submit */
  isEmbed?: boolean;
}

function formatTimeAr(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function todayIsoAr(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function BookingForm({
  slug,
  serviceId,
  professionals,
  serviceName,
  isEmbed,
}: BookingFormProps) {
  const [date, setDate] = useState<string>(todayIsoAr());
  const [professionalId, setProfessionalId] = useState<string>('');
  const [slotsByPro, setSlotsByPro] = useState<SlotData[]>([]);
  const [aggregateSlots, setAggregateSlots] = useState<string[] | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [loading, startLoading] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  // Cargar slots cuando cambian fecha o profesional
  useEffect(() => {
    if (!date) return;
    setSelectedSlot('');
    setErrorMsg(null);

    const params = new URLSearchParams({
      slug,
      service_id: serviceId,
      date,
    });
    if (professionalId) params.set('professional_id', professionalId);

    startLoading(async () => {
      try {
        const res = await fetch(`/api/slots?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error ?? 'Error al cargar disponibilidad');
          setSlotsByPro([]);
          setAggregateSlots(null);
          return;
        }
        setSlotsByPro(data.professionals ?? []);
        setAggregateSlots(data.aggregate_slots ?? null);
      } catch {
        setErrorMsg('Error de red al cargar disponibilidad');
      }
    });
  }, [date, professionalId, slug, serviceId]);

  // Si seleccioné "cualquiera" y elijo un slot, asignarlo a la primera pro disponible
  function chooseSlot(iso: string, fromProId?: string) {
    setSelectedSlot(iso);
    if (!fromProId && !professionalId) {
      // "cualquiera": elegir la primera pro que tenga ese slot
      const pro = slotsByPro.find((p) => p.slots.includes(iso));
      if (pro) setProfessionalId(pro.professional_id);
    }
  }

  const minDate = todayIsoAr();
  const maxDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(d);
  })();

  const slotsForChosenProfessional = professionalId
    ? slotsByPro.find((p) => p.professional_id === professionalId)?.slots ?? []
    : aggregateSlots ?? [];

  return (
    <>
    <form action={createPublicReservation} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="service_id" value={serviceId} />
      <input type="hidden" name="starts_at" value={selectedSlot} />
      <input type="hidden" name="professional_id" value={professionalId} />
      {isEmbed && <input type="hidden" name="embed" value="1" />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="date">Día *</Label>
          <Input
            id="date"
            type="date"
            value={date}
            min={minDate}
            max={maxDate}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="professional_id">Profesional</Label>
          <select
            id="professional_id"
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <option value="">Cualquiera disponible</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name ?? 'Profesional'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-stone-700">
          <ClockIcon className="h-4 w-4" />
          Horarios disponibles
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-stone-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Buscando disponibilidad...
          </div>
        ) : errorMsg ? (
          <p className="text-sm text-red-600">{errorMsg}</p>
        ) : slotsForChosenProfessional.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-stone-500">
              No hay turnos disponibles para {serviceName} ese día. Probá con otra fecha o
              profesional.
            </p>
            {!waitlistOpen ? (
              <button
                type="button"
                onClick={() => setWaitlistOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100"
              >
                <Bell className="h-4 w-4" />
                Anotame en la lista de espera
              </button>
            ) : (
              <div className="rounded-xl border border-brand-200 bg-white p-3 text-sm text-stone-500">
                <p className="mb-2 text-xs">
                  Te avisamos por WhatsApp cuando se libere un turno para este servicio.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
            {slotsForChosenProfessional.map((iso) => (
              <button
                key={iso}
                type="button"
                onClick={() => chooseSlot(iso)}
                className={`min-h-[40px] rounded-lg border py-2.5 px-2 text-sm tabular-nums transition-colors ${
                  selectedSlot === iso
                    ? 'border-brand-500 bg-brand-500 text-white font-medium'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-brand-300 hover:bg-brand-50'
                }`}
              >
                {formatTimeAr(iso)}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedSlot && (
        <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <p className="text-sm font-medium text-emerald-800">
            Turno seleccionado: <strong>{formatTimeAr(selectedSlot)}</strong> del{' '}
            <strong>{date}</strong>
            {professionalId && (
              <>
                {' con '}
                <span className="break-words">
                  {professionals.find((p) => p.id === professionalId)?.display_name ?? ''}
                </span>
              </>
            )}
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="full_name">Tu nombre *</Label>
            <Input id="full_name" name="full_name" required placeholder="Nombre y apellido" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone">WhatsApp *</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                required
                placeholder="+549..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="tu@email.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dni">DNI *</Label>
            <Input
              id="dni"
              name="dni"
              type="text"
              inputMode="numeric"
              required
              pattern="\d{7,8}"
              title="DNI sin puntos (7 u 8 dígitos)"
              placeholder="Sin puntos"
              maxLength={10}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Comentarios</Label>
            <Textarea id="notes" name="notes" rows={2} placeholder="Opcional" />
          </div>

          <p className="text-xs text-stone-600">
            Vamos a enviarte por WhatsApp un código de 6 dígitos para que puedas cancelar o
            reagendar el turno si lo necesitás.
          </p>

          <SubmitButton className="w-full" size="lg" pendingText="Reservando...">
            Confirmar reserva
          </SubmitButton>
        </div>
      )}
    </form>

    {waitlistOpen && (
      <form action={addToWaitlistPublic} className="space-y-3 rounded-xl border border-brand-200 bg-white p-4">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="service_id" value={serviceId} />
        <input type="hidden" name="preferred_date" value={date} />
        {isEmbed && <input type="hidden" name="embed" value="1" />}

        <h3 className="text-sm font-semibold text-stone-900">Sumate a la lista de espera</h3>
        <p className="text-xs text-stone-500">
          Te avisamos por WhatsApp cuando se libere un turno para {serviceName}.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="wl_full_name">Tu nombre *</Label>
          <Input id="wl_full_name" name="full_name" required placeholder="Nombre y apellido" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="wl_phone">WhatsApp *</Label>
            <Input id="wl_phone" name="phone" type="tel" required placeholder="+549..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wl_email">Email *</Label>
            <Input id="wl_email" name="email" type="email" required placeholder="tu@email.com" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="wl_dni">DNI *</Label>
          <Input
            id="wl_dni"
            name="dni"
            type="text"
            inputMode="numeric"
            required
            pattern="\d{7,8}"
            title="DNI sin puntos (7 u 8 dígitos)"
            placeholder="Sin puntos"
            maxLength={10}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="wl_notes">Comentarios</Label>
          <Textarea
            id="wl_notes"
            name="notes"
            rows={2}
            placeholder="Ej. solo a la mañana, prefiero a María, etc."
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setWaitlistOpen(false)}
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
          >
            Cancelar
          </button>
          <SubmitButton className="flex-1" pendingText="Anotándote...">
            Anotarme
          </SubmitButton>
        </div>
      </form>
    )}
    </>
  );
}
