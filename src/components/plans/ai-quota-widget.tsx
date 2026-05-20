import Link from 'next/link';
import { cookies } from 'next/headers';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { getOrgFeatureContext } from '@/lib/plans/subscription-service';
import {
  computeQuotaStatus,
  getOrCreateCurrentCounter,
} from '@/lib/plans/ai-quota-service';

/**
 * Widget de cuota IA del período en curso. Server component.
 *
 * Muestra 2 barras (skin diagnosis + protocol generator). Si la org es
 * grandfathered o plan con cuota null, muestra "ilimitado". A partir del
 * 80% de uso muestra tip de upgrade/addon.
 *
 * Si no hay sub activa, no renderiza nada (la UI superior ya tiene un
 * banner para ese caso).
 */
export async function AiQuotaWidget() {
  const orgId = cookies().get('active_org')?.value;
  if (!orgId) return null;

  const { subscription, isGrandfathered } = await getOrgFeatureContext(orgId);
  if (!subscription) return null;

  let counter;
  try {
    counter = await getOrCreateCurrentCounter(subscription);
  } catch {
    return null;
  }

  const skin = computeQuotaStatus(subscription.plan_id, counter, 'skin_diagnosis', isGrandfathered);
  const protocolStatus = computeQuotaStatus(subscription.plan_id, counter, 'protocol', isGrandfathered);

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-500" />
          <h3 className="text-sm font-semibold text-stone-900">Uso de IA este mes</h3>
        </div>
        <Link
          href="/ia"
          className="text-xs text-brand-600 hover:underline"
        >
          Ir a IA →
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <QuotaBar
          label="Análisis de piel"
          used={skin.used}
          total={skin.total_available}
          bonus={skin.bonus}
        />
        <QuotaBar
          label="Protocolos"
          used={protocolStatus.used}
          total={protocolStatus.total_available}
          bonus={protocolStatus.bonus}
        />
      </div>

      {(skin.exhausted || protocolStatus.exhausted) && (
        <UpgradeTip exhausted />
      )}
      {!skin.exhausted &&
        !protocolStatus.exhausted &&
        (isAt80Percent(skin) || isAt80Percent(protocolStatus)) && (
          <UpgradeTip exhausted={false} />
        )}
    </div>
  );
}

function isAt80Percent(s: {
  used: number;
  total_available: number | null;
}): boolean {
  if (s.total_available === null) return false;
  if (s.total_available === 0) return false;
  return s.used / s.total_available >= 0.8;
}

function QuotaBar({
  label,
  used,
  total,
  bonus,
}: {
  label: string;
  used: number;
  total: number | null;
  bonus: number;
}) {
  if (total === null) {
    return (
      <div>
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-stone-600">{label}</span>
          <span className="font-semibold text-emerald-700">ilimitado</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-emerald-100" />
      </div>
    );
  }

  const pct = total === 0 ? 0 : Math.min(100, (used / total) * 100);
  const exhausted = used >= total;
  const near = pct >= 80;

  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-stone-600">{label}</span>
        <span className={`font-semibold ${exhausted ? 'text-red-700' : near ? 'text-amber-700' : 'text-stone-900'}`}>
          {used} de {total}
          {bonus > 0 && (
            <span className="ml-1 text-emerald-700">(+{bonus})</span>
          )}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-stone-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            exhausted ? 'bg-red-500' : near ? 'bg-amber-500' : 'bg-brand-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function UpgradeTip({ exhausted }: { exhausted: boolean }) {
  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
      <p className="flex items-start gap-2 text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {exhausted
            ? 'Te quedaste sin cuota este mes.'
            : 'Estás llegando al límite de cuota.'}{' '}
          Podés{' '}
          <Link href="/precios" className="font-medium underline">
            subir de plan
          </Link>{' '}
          o{' '}
          <Link href="/ia" className="font-medium underline">
            comprar un pack extra
          </Link>
          .
        </span>
      </p>
    </div>
  );
}
