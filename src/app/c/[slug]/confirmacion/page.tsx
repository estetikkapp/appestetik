import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

export default function ReservationConfirmationPage({ params }: { params: { slug: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h1 className="mt-4 text-2xl font-bold text-stone-900">¡Reserva recibida!</h1>
        <p className="mt-3 text-sm text-stone-600">
          Tu turno quedó en estado <strong>Pendiente de confirmación</strong>. El centro te va a
          contactar por WhatsApp para confirmarlo.
        </p>
        <p className="mt-6 text-xs text-stone-400">
          ¿Te equivocaste en algo?{' '}
          <Link href={`/c/${params.slug}`} className="text-brand-600 hover:underline">
            Hacer otra reserva
          </Link>
        </p>
      </div>
    </main>
  );
}
