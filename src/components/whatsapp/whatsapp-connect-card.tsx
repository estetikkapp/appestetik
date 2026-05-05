'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { SubmitButton } from '@/components/ui/submit-button';
import { connectWhatsappAction, disconnectWhatsappAction } from '@/actions/whatsapp';

type WappStatus = 'disconnected' | 'connecting' | 'connected';

interface Props {
  initialStatus: WappStatus;
  initialPhone: string | null;
  /** true cuando la URL tiene ?wapp=qr (recién se inició la conexión) */
  startPolling?: boolean;
}

export function WhatsappConnectCard({ initialStatus, initialPhone, startPolling }: Props) {
  const [status, setStatus] = useState<WappStatus>(initialStatus);
  const [phone, setPhone] = useState<string | null>(initialPhone);
  const [qr, setQr] = useState<string | null>(null);
  const [polling, setPolling] = useState(startPolling ?? false);

  useEffect(() => {
    if (!polling) return;
    let active = true;

    async function poll() {
      while (active) {
        await new Promise((r) => setTimeout(r, 3000));
        if (!active) break;

        try {
          const res = await fetch('/api/whatsapp/status');
          const data: { status: WappStatus; qr?: string; phone?: string } = await res.json();

          setStatus(data.status);
          if (data.qr) setQr(data.qr);
          if (data.phone) setPhone(data.phone);

          if (data.status === 'connected') {
            setPolling(false);
            setQr(null);
            break;
          }
        } catch {
          // red inestable — seguir intentando
        }
      }
    }

    poll();
    return () => {
      active = false;
    };
  }, [polling]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          {status === 'connected' && phone && (
            <span className="text-sm text-stone-600">{phone}</span>
          )}
        </div>

        {status === 'connected' ? (
          <form action={disconnectWhatsappAction}>
            <SubmitButton variant="outline" size="sm" pendingText="Desconectando...">
              Desconectar
            </SubmitButton>
          </form>
        ) : status === 'disconnected' ? (
          <form action={connectWhatsappAction}>
            <SubmitButton size="sm" pendingText="Iniciando...">
              Conectar WhatsApp
            </SubmitButton>
          </form>
        ) : null}
      </div>

      {status === 'connecting' && (
        <div className="space-y-3">
          {qr ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 p-6">
              <p className="text-sm text-stone-600">
                Abrí WhatsApp en el celular → Dispositivos vinculados → Vincular dispositivo
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`}
                alt="QR WhatsApp"
                className="h-52 w-52 rounded-lg border border-stone-200"
              />
              <p className="text-xs text-stone-400">El QR se actualiza automáticamente</p>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-stone-200 bg-stone-50 py-10">
              <p className="text-sm text-stone-500">Cargando QR...</p>
            </div>
          )}
        </div>
      )}

      {status === 'connected' && (
        <p className="text-xs text-stone-500">
          Los recordatorios se envían automáticamente 24hs antes de cada turno.
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: WappStatus }) {
  if (status === 'connected') return <Badge variant="success">Conectado</Badge>;
  if (status === 'connecting') return <Badge variant="secondary">Esperando QR...</Badge>;
  return <Badge variant="secondary">Desconectado</Badge>;
}
