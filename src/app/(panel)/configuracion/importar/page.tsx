import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { requireMembership } from '@/lib/auth/require-membership';
import { ImporterUI } from './importer-ui';

export const metadata = { title: 'Importar datos — appestetika' };

export default async function ImportarPage() {
  await requireMembership({ minRole: 'admin' });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/configuracion"
          className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a configuración
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-stone-900">
          <Sparkles className="h-6 w-6 text-brand-500" />
          Importar clientas con IA
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Subí cualquier archivo con tu lista de clientas (Excel, planilla,
          foto del cuaderno, captura de WhatsApp, PDF) y la IA extrae los
          datos automáticamente. Después revisás y confirmás.
        </p>
      </div>

      <ImporterUI />
    </div>
  );
}
