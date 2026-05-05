'use client';

import { useState } from 'react';
import { Plus, Pencil, Archive, ArchiveRestore } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { DeleteConfirmButton } from '@/components/ui/delete-confirm-button';
import {
  createScheduleTemplate,
  updateScheduleTemplate,
  toggleScheduleTemplateActive,
  deleteScheduleTemplate,
} from '@/actions/schedule-templates';
import type { Tables } from '@/types/database';

interface AttentionWindow {
  weekday: number;
  start_time: string;
  end_time: string;
}

interface Props {
  mode: 'create' | 'edit';
  template?: Tables<'schedule_templates'>;
}

const DAYS = [
  { idx: 1, label: 'Lunes' },
  { idx: 2, label: 'Martes' },
  { idx: 3, label: 'Miércoles' },
  { idx: 4, label: 'Jueves' },
  { idx: 5, label: 'Viernes' },
  { idx: 6, label: 'Sábado' },
  { idx: 0, label: 'Domingo' },
];

function defaultsFor(day: number): { active: boolean; opens: string; closes: string } {
  if (day === 0) return { active: false, opens: '09:00', closes: '13:00' };
  if (day === 6) return { active: true, opens: '09:00', closes: '13:00' };
  return { active: true, opens: '09:00', closes: '19:00' };
}

export function TemplatesClient({ mode, template }: Props) {
  const [open, setOpen] = useState(false);

  const existingByDay: Record<number, AttentionWindow> = {};
  if (template) {
    const wins = (template.attention_windows as unknown as AttentionWindow[]) ?? [];
    for (const w of wins) existingByDay[w.weekday] = w;
  }

  const formContent = (
    <form
      action={mode === 'create' ? createScheduleTemplate : updateScheduleTemplate}
      className="space-y-5"
    >
      {template && <input type="hidden" name="id" value={template.id} />}

      <div className="space-y-1.5">
        <Label htmlFor="name">Nombre *</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={template?.name ?? ''}
          placeholder="Ej. Mariana — Mañanas"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="slot_minutes">Granularidad de slots (minutos)</Label>
        <select
          id="slot_minutes"
          name="slot_minutes"
          defaultValue={template?.slot_minutes ?? 30}
          className="flex h-10 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <option value={15}>15 min</option>
          <option value={20}>20 min</option>
          <option value={30}>30 min</option>
          <option value={45}>45 min</option>
          <option value={60}>60 min</option>
        </select>
        <p className="text-xs text-stone-500">
          Cada cuánto aparece un slot de inicio. La duración real del turno depende del servicio.
        </p>
      </div>

      <div>
        <Label className="mb-2 block">Días y horarios *</Label>
        <div className="space-y-2">
          {DAYS.map(({ idx, label }) => {
            const saved = existingByDay[idx];
            const fb = defaultsFor(idx);
            const active = saved ? true : fb.active;
            const start = saved?.start_time ?? fb.opens;
            const end = saved?.end_time ?? fb.closes;
            return (
              <div
                key={idx}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 p-3"
              >
                <label className="flex w-24 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    name={`active_${idx}`}
                    defaultChecked={active}
                    className="h-4 w-4 accent-brand-500"
                  />
                  <span className="text-sm font-medium">{label}</span>
                </label>
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="time"
                    name={`start_${idx}`}
                    defaultValue={start}
                    className="rounded-md border border-stone-300 px-2 py-1 text-sm"
                  />
                  <span className="text-xs text-stone-400">→</span>
                  <input
                    type="time"
                    name={`end_${idx}`}
                    defaultValue={end}
                    className="rounded-md border border-stone-300 px-2 py-1 text-sm"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 p-3">
        <input
          type="checkbox"
          name="is_default"
          defaultChecked={template?.is_default ?? false}
          className="h-4 w-4 accent-brand-500"
        />
        <div>
          <span className="text-sm font-medium">Plantilla por defecto</span>
          <p className="text-xs text-stone-500">
            Profesionales nuevos usan esta plantilla automáticamente.
          </p>
        </div>
      </label>

      <div className="flex justify-end pt-2">
        <SubmitButton pendingText="Guardando...">
          {mode === 'create' ? 'Crear plantilla' : 'Guardar cambios'}
        </SubmitButton>
      </div>
    </form>
  );

  if (mode === 'create') {
    return (
      <>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva plantilla
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>Nueva plantilla</SheetTitle>
              <SheetDescription>Días, horarios y granularidad de slots.</SheetDescription>
            </SheetHeader>
            <div className="mt-6">{formContent}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  if (!template) return null;

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <form action={toggleScheduleTemplateActive}>
        <input type="hidden" name="id" value={template.id} />
        <input type="hidden" name="active" value={String(template.active)} />
        <SubmitButton variant="ghost" size="sm" hideSpinner>
          {template.active ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
        </SubmitButton>
      </form>
      <DeleteConfirmButton
        action={deleteScheduleTemplate}
        id={template.id}
        itemLabel={`la plantilla "${template.name}"`}
        description="Las profesionales que usen esta plantilla quedarán sin horario hasta que les asignes otra."
      />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Editar plantilla</SheetTitle>
            <SheetDescription>{template.name}</SheetDescription>
          </SheetHeader>
          <div className="mt-6">{formContent}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
