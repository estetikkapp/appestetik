import { cookies } from 'next/headers';
import { Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TemplatesClient } from './templates-client';

export const metadata = { title: 'Horarios — appestetika' };

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

interface AttentionWindow {
  weekday: number;
  start_time: string;
  end_time: string;
}

async function loadData() {
  const supabase = createClient();
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return null;

  const { data } = await supabase
    .from('schedule_templates')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  return data ?? [];
}

function summarizeWindows(windows: AttentionWindow[]): string {
  if (windows.length === 0) return 'Sin horarios';
  const byDay: Record<number, AttentionWindow[]> = {};
  for (const w of windows) {
    if (!byDay[w.weekday]) byDay[w.weekday] = [];
    byDay[w.weekday]!.push(w);
  }
  return Object.keys(byDay)
    .map((d) => Number(d))
    .sort()
    .map((d) => {
      const list = byDay[d]!.map((w) => `${w.start_time}-${w.end_time}`).join(', ');
      return `${DAY_LABELS[d]} ${list}`;
    })
    .join(' · ');
}

export default async function HorariosPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string };
}) {
  const templates = (await loadData()) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-900">
            <Clock className="h-6 w-6 text-brand-500" />
            Horarios de atención
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Plantillas de horarios reutilizables. Cada profesional usa una. Definen los slots
            disponibles para reservar turnos.
          </p>
        </div>
        <TemplatesClient mode="create" />
      </div>

      {searchParams.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}
      {searchParams.ok && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Plantilla {searchParams.ok}.
        </div>
      )}

      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Horarios</TableHead>
              <TableHead>Granularidad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-44 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-stone-400">
                  Aún no hay plantillas. Crea la primera con el botón de arriba.
                </TableCell>
              </TableRow>
            )}
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <div className="font-medium">{t.name}</div>
                  {t.is_default && (
                    <Badge variant="premium" className="mt-1">
                      Default
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="max-w-md text-xs text-stone-600">
                  {summarizeWindows(t.attention_windows as unknown as AttentionWindow[])}
                </TableCell>
                <TableCell className="tabular-nums">cada {t.slot_minutes} min</TableCell>
                <TableCell>
                  {t.active ? (
                    <Badge variant="success">Activa</Badge>
                  ) : (
                    <Badge variant="secondary">Archivada</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <TemplatesClient mode="edit" template={t} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
