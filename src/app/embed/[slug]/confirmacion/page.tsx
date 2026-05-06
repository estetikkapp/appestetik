import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

export default function EmbedConfirmationPage({ params }: { params: { slug: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <h1 className="mt-3 text-lg font-bold text-stone-900">¡Reserva recibida!</h1>
        <p className="mt-2 text-sm text-stone-600">
          Tu turno quedó <strong>Pendiente</strong>. El centro te confirma por WhatsApp.
        </p>
        <p className="mt-4 text-xs text-stone-400">
          <Link href={`/embed/${params.slug}`} className="text-brand-600 hover:underline">
            Hacer otra reserva
          </Link>
        </p>
      </div>
    </main>
  );
}
