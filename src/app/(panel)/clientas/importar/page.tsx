import Link from 'next/link';
import { ArrowLeft, FileSpreadsheet } from 'lucide-react';
import { ImportClientsClient } from './import-client';

export const metadata = { title: 'Importar clientas — appestetika' };

const SAMPLE_CSV = `nombre,telefono,email,dni,cumple,notas
María González,+5491155551234,maria@example.com,30123456,1985-03-15,prefiere por la mañana
Lucía Pérez,+5491166665678,lucia@example.com,32456789,1990-07-20,
Sofía Rodríguez,+5491177779999,,28987654,,muy puntual`;

export default async function ImportarClientasPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/clientas"
          className="mb-2 inline-flex items-center gap-1 text-xs text-stone-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-3 w-3" />
          Volver a Clientas
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-900">
          <FileSpreadsheet className="h-6 w-6 text-brand-500" />
          Importar clientas desde CSV
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Subí un archivo CSV o pegá el contenido. El sistema valida cada fila y salta las que ya
          existen (mismo teléfono).
        </p>
      </div>

      {searchParams.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}

      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="mb-2 text-base font-semibold">Formato esperado</h2>
        <p className="mb-3 text-xs text-stone-500">
          Columnas reconocidas (la primera fila debe ser el header): <code>nombre</code>{' '}
          (obligatorio), <code>telefono</code>, <code>email</code>, <code>dni</code>,{' '}
          <code>cumple</code>, <code>notas</code>. Aceptamos sinónimos comunes (ej. &quot;celular&quot;,
          &quot;mail&quot;, &quot;documento&quot;, &quot;observaciones&quot;).
        </p>
        <pre className="overflow-x-auto rounded-lg bg-stone-50 p-3 text-[11px] text-stone-700">
{SAMPLE_CSV}
        </pre>
      </section>

      <ImportClientsClient />
    </div>
  );
}
