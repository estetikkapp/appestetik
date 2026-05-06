import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rowsToCsv, csvFilename } from '@/lib/utils/csv';
import { formatDateTimeAr } from '@/lib/utils/dates';

export const runtime = 'nodejs';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  mp_card: 'MP tarjeta',
  mp_link: 'Link MP',
  transfer: 'Transferencia',
  package_credit: 'Paquete',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Cobrado',
  rejected: 'Rechazado',
  refunded: 'Devuelto',
  cancelled: 'Cancelado',
};

const APPT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  in_progress: 'En curso',
  completed: 'Completado',
  cancelled: 'Cancelado',
  no_show: 'No vino',
};

/**
 * Export CSV.
 * Query params:
 *   type   = appointments | payments | clients
 *   from   = ISO date YYYY-MM-DD (incluido)
 *   to     = ISO date YYYY-MM-DD (incluido)
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = cookies().get('active_org')?.value;
  if (!orgId) {
    return NextResponse.json({ error: 'Sin org activa' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'appointments';
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json({ error: 'Falta from/to' }, { status: 400 });
  }

  // Convertir from/to a ISO con TZ AR (-03:00)
  const fromIso = `${from}T00:00:00-03:00`;
  // 'to' inclusivo → fin del día
  const toIso = `${to}T23:59:59.999-03:00`;

  if (type === 'appointments') {
    const [apptsResult, membersResult] = await Promise.all([
      supabase
        .from('appointments')
        .select(
          `id, starts_at, ends_at, status, source, notes, professional_id,
           client:clients(full_name, phone_e164),
           service:services(name, price_ars)`
        )
        .eq('organization_id', orgId)
        .gte('starts_at', fromIso)
        .lte('starts_at', toIso)
        .order('starts_at', { ascending: true }),
      supabase
        .from('memberships')
        .select('user_id, display_name')
        .eq('organization_id', orgId),
    ]);

    if (apptsResult.error) {
      console.error('[reports/export appointments]', apptsResult.error);
      return NextResponse.json({ error: 'query failed' }, { status: 500 });
    }

    const profMap = new Map<string, string>();
    for (const m of membersResult.data ?? []) {
      if (m.user_id) profMap.set(m.user_id, m.display_name ?? '');
    }

    const rows = (apptsResult.data ?? []).map((a) => {
      const cli = Array.isArray(a.client) ? a.client[0] : a.client;
      const svc = Array.isArray(a.service) ? a.service[0] : a.service;
      return [
        formatDateTimeAr(a.starts_at),
        formatDateTimeAr(a.ends_at),
        cli?.full_name ?? '',
        cli?.phone_e164 ?? '',
        svc?.name ?? '',
        a.professional_id ? profMap.get(a.professional_id) ?? '' : '',
        APPT_STATUS_LABELS[a.status] ?? a.status,
        a.source,
        Number(svc?.price_ars ?? 0),
        a.notes ?? '',
      ];
    });

    const csv = rowsToCsv(
      [
        'Inicio',
        'Fin',
        'Clienta',
        'Teléfono',
        'Servicio',
        'Profesional',
        'Estado',
        'Origen',
        'Precio (ARS)',
        'Notas',
      ],
      rows
    );

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${csvFilename('turnos')}"`,
      },
    });
  }

  if (type === 'payments') {
    const { data, error } = await supabase
      .from('payments')
      .select(
        `id, amount_ars, method, status, paid_at, created_at, notes,
         client:clients(full_name, phone_e164)`
      )
      .eq('organization_id', orgId)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[reports/export payments]', error);
      return NextResponse.json({ error: 'query failed' }, { status: 500 });
    }

    const rows = (data ?? []).map((p) => {
      const cli = Array.isArray(p.client) ? p.client[0] : p.client;
      return [
        formatDateTimeAr(p.paid_at ?? p.created_at),
        cli?.full_name ?? '',
        cli?.phone_e164 ?? '',
        PAYMENT_METHOD_LABELS[p.method] ?? p.method,
        PAYMENT_STATUS_LABELS[p.status] ?? p.status,
        Number(p.amount_ars),
        p.notes ?? '',
      ];
    });

    const csv = rowsToCsv(
      ['Fecha', 'Clienta', 'Teléfono', 'Método', 'Estado', 'Monto (ARS)', 'Notas'],
      rows
    );

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${csvFilename('cobros')}"`,
      },
    });
  }

  if (type === 'clients') {
    const { data, error } = await supabase
      .from('clients')
      .select('id, full_name, phone_e164, email, dni, birthdate, created_at')
      .eq('organization_id', orgId)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[reports/export clients]', error);
      return NextResponse.json({ error: 'query failed' }, { status: 500 });
    }

    const rows = (data ?? []).map((c) => [
      formatDateTimeAr(c.created_at),
      c.full_name,
      c.phone_e164 ?? '',
      c.email ?? '',
      c.dni ?? '',
      c.birthdate ?? '',
    ]);

    const csv = rowsToCsv(
      ['Alta', 'Nombre', 'Teléfono', 'Email', 'DNI', 'Fecha de nac.'],
      rows
    );

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${csvFilename('clientas')}"`,
      },
    });
  }

  return NextResponse.json({ error: 'type inválido' }, { status: 400 });
}
