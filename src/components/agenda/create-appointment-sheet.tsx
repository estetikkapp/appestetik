'use client';

import { useEffect, useState } from 'react';
import { Plus, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { createAppointment } from '@/actions/appointments';

interface Option {
  id: string;
  label: string;
  sublabel?: string;
}

interface Props {
  services: Option[];
  clients: Option[];
  professionals: Option[];
  resources: Option[];
  defaultDate?: string; // YYYY-MM-DD
}

export function CreateAppointmentSheet({
  services,
  clients,
  professionals,
  resources,
  defaultDate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [date, setDate] = useState(defaultDate ?? '');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualDateTime, setManualDateTime] = useState('');

  const [slots, setSlots] = useState<string[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slotsHint, setSlotsHint] = useState<string | null>(null);

  // Fetch slots cuando cambian los inputs relevantes
  useEffect(() => {
    if (manualMode || !serviceId || !date) {
      setSlots(null);
      setSlotsError(null);
      setSlotsHint(null);
      return;
    }
    let cancelled = false;
    setLoadingSlots(true);
    setSlotsError(null);
    setSlotsHint(null);
    setSelectedSlot(null);

    const params = new URLSearchParams({ service_id: serviceId, date });
    if (professionalId) params.set('professional_id', professionalId);

    fetch(`/api/internal/slots?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setSlotsError(data.error);
        } else {
          setSlots(data.slots ?? []);
          if (data.hint) setSlotsHint(data.hint);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setSlotsError(err instanceof Error ? err.message : 'Error de red');
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [serviceId, date, professionalId, manualMode]);

  function resetForm() {
    setServiceId('');
    setProfessionalId('');
    setDate(defaultDate ?? '');
    setSelectedSlot(null);
    setManualMode(false);
    setManualDateTime('');
    setSlots(null);
  }

  const finalStartsAt = manualMode ? manualDateTime : selectedSlot ?? '';

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Nuevo turno
      </Button>
      <Sheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) resetForm();
        }}
      >
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Nuevo turno</SheetTitle>
            <SheetDescription>
              Solo se muestran horarios disponibles según horario del profesional y turnos existentes.
            </SheetDescription>
          </SheetHeader>
          <form action={createAppointment} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="client_id">Clienta *</Label>
              <SelectNative id="client_id" name="client_id" required options={clients} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="service_id">Servicio *</Label>
              <SelectNative
                id="service_id"
                name="service_id"
                required
                options={services}
                value={serviceId}
                onChange={setServiceId}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="professional_id">Profesional</Label>
                <SelectNative
                  id="professional_id"
                  name="professional_id"
                  options={professionals}
                  emptyLabel="Cualquiera"
                  value={professionalId}
                  onChange={setProfessionalId}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="resource_id">Recurso</Label>
                <SelectNative
                  id="resource_id"
                  name="resource_id"
                  options={resources}
                  emptyLabel="Ninguno"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="date">Fecha *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {/* Slot picker o input manual */}
            {!manualMode ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Horario disponible *</Label>
                  <button
                    type="button"
                    onClick={() => setManualMode(true)}
                    className="text-xs text-stone-500 hover:text-brand-600"
                  >
                    Hora manual →
                  </button>
                </div>

                {!serviceId || !date ? (
                  <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-center text-xs text-stone-500">
                    Elegí servicio y fecha para ver horarios disponibles.
                  </div>
                ) : loadingSlots ? (
                  <div className="flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando horarios...
                  </div>
                ) : slotsError ? (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{slotsError}</p>
                  </div>
                ) : slots && slots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                    {slots.map((iso) => {
                      const time = new Date(iso).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                        timeZone: 'America/Argentina/Buenos_Aires',
                      });
                      const selected = selectedSlot === iso;
                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => setSelectedSlot(iso)}
                          className={`rounded-lg border px-2 py-1.5 text-xs transition ${
                            selected
                              ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700'
                              : 'border-stone-200 bg-white hover:border-brand-300 hover:bg-brand-50'
                          }`}
                        >
                          {time}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <p className="font-medium">No hay horarios disponibles este día.</p>
                    {slotsHint ? (
                      <p className="mt-1">{slotsHint}</p>
                    ) : (
                      <p className="mt-1">
                        Probá otra fecha, otro profesional, o usá &quot;Hora manual&quot; para forzar un
                        horario fuera del calendario.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="manual_dt">Fecha y hora manual *</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setManualMode(false);
                      setManualDateTime('');
                    }}
                    className="text-xs text-stone-500 hover:text-brand-600"
                  >
                    ← Ver disponibles
                  </button>
                </div>
                <Input
                  id="manual_dt"
                  type="datetime-local"
                  value={manualDateTime}
                  onChange={(e) => setManualDateTime(e.target.value)}
                  required
                />
                <p className="text-xs text-amber-700">
                  ⚠️ Modo manual: no se valida horario de atención del profesional.
                </p>
              </div>
            )}

            {/* Hidden input que la action lee.
               - Modo slot: enviamos el ISO UTC tal cual (TZ correcta)
               - Modo manual: enviamos datetime-local sin TZ (parser asume server TZ) */}
            <input
              type="hidden"
              name="starts_at"
              value={manualMode ? manualDateTime : selectedSlot ?? ''}
            />

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" name="notes" rows={2} placeholder="Opcional" />
            </div>

            <div className="flex justify-end pt-2">
              <SubmitButton pendingText="Creando turno..." disabled={!finalStartsAt}>
                Crear turno
              </SubmitButton>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function SelectNative({
  id,
  name,
  required,
  options,
  emptyLabel = 'Seleccionar',
  value,
  onChange,
}: {
  id: string;
  name: string;
  required?: boolean;
  options: Option[];
  emptyLabel?: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  // Soporta dos modos:
  //   - Controlado (servicio, profesional): se pasa `value` + `onChange` y el padre
  //     necesita observar cambios para refetch de slots, etc.
  //   - Uncontrolled (cliente, recurso): el padre no necesita el valor en JSX,
  //     basta con que el name salga en el FormData del submit. Si fijáramos
  //     `value=""` sin `onChange` real, React bloquea las selecciones del user.
  const controlled = value !== undefined;
  return (
    <select
      id={id}
      name={name}
      required={required}
      value={controlled ? value : undefined}
      defaultValue={controlled ? undefined : ''}
      onChange={controlled ? (e) => onChange?.(e.target.value) : undefined}
      className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:text-sm"
    >
      <option value="">{emptyLabel}</option>
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.label}
          {opt.sublabel ? ` — ${opt.sublabel}` : ''}
        </option>
      ))}
    </select>
  );
}
