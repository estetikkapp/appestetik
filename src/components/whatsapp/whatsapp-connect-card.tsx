'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { connectWhatsappAction, disconnectWhatsappAction } from '@/actions/whatsapp';

type WappStatus = 'disconnected' | 'connecting' | 'connected';

interface Props {
  initialStatus: WappStatus;
  initialPhone: string | null;
  /** true cuando la URL tiene ?wapp=qr (recién se inició la conexión) */
  startPolling?: boolean;
}

interface TestResult {
  ok: boolean;
  code?: string;
  message?: string;
  detail?: string;
  elapsed_ms?: number;
  instances?: number;
  config?: { url_present: boolean; url_host: string | null; key_present: boolean };
  hints?: string[];
}

export function WhatsappConnectCard({ initialStatus, initialPhone, startPolling }: Props) {
  const [status, setStatus] = useState<WappStatus>(initialStatus);
  const [phone, setPhone] = useState<string | null>(initialPhone);
  const [qr, setQr] = useState<string | null>(null);
  const [polling, setPolling] = useState(startPolling ?? false);
  const [test, setTest] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Leer ?error= de la URL al montar — útil cuando connectWhatsappAction
  // redirige con error y el banner global queda fuera de viewport.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) setUrlError(err);
  }, []);

  // Auto-run del test si arrancamos desconectados (sin haber clickeado nada)
  // Da feedback inmediato del problema sin que el user tenga que apretar nada.
  useEffect(() => {
    if (initialStatus !== 'disconnected') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/whatsapp/test');
        const data = await res.json();
        if (!cancelled) setTest(data);
      } catch {
        // silencioso — el botón Probar conexión queda como fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialStatus]);

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

  async function runTest() {
    setTesting(true);
    setTest(null);
    try {
      const res = await fetch('/api/whatsapp/test');
      const data = await res.json();
      setTest(data);
    } catch (err) {
      setTest({
        ok: false,
        message: err instanceof Error ? err.message : 'Error de red',
        hints: ['No se pudo llamar al endpoint de test. Recargá la página y reintentá.'],
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          {status === 'connected' && phone && (
            <span className="text-sm text-stone-600">{phone}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={runTest} disabled={testing}>
            {testing ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Wifi className="mr-1 h-3 w-3" />
            )}
            Probar conexión
          </Button>

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
      </div>

      {urlError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="font-medium">El último intento de conectar falló</p>
            <p className="mt-0.5 text-xs">{urlError}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setUrlError(null);
              if (typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                url.searchParams.delete('error');
                window.history.replaceState({}, '', url.toString());
              }
            }}
            className="text-xs opacity-60 hover:opacity-100"
            title="Cerrar"
          >
            ✕
          </button>
        </div>
      )}

      {test && <TestPanel result={test} />}

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

function TestPanel({ result }: { result: TestResult }) {
  return (
    <div
      className={`rounded-xl border p-3 text-sm ${
        result.ok
          ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800'
          : 'border-red-200 bg-red-50 text-red-800'
      }`}
    >
      <div className="mb-2 flex items-start gap-2">
        {result.ok ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
        )}
        <div className="flex-1">
          <p className="font-medium">
            {result.ok ? 'Conexión OK' : 'Conexión falla'}
            {result.elapsed_ms !== undefined && (
              <span className="ml-2 text-xs font-normal opacity-70">
                {result.elapsed_ms}ms
              </span>
            )}
          </p>
          {result.message && <p className="mt-0.5 text-xs">{result.message}</p>}
        </div>
      </div>

      {result.config && (
        <dl className="ml-6 grid grid-cols-1 gap-1 text-xs sm:grid-cols-3">
          <div>
            <dt className="opacity-60">URL configurada</dt>
            <dd className="font-mono">
              {result.config.url_present ? result.config.url_host ?? '✓' : '✗ falta'}
            </dd>
          </div>
          <div>
            <dt className="opacity-60">API key</dt>
            <dd className="font-mono">{result.config.key_present ? '✓ presente' : '✗ falta'}</dd>
          </div>
          {result.instances !== undefined && (
            <div>
              <dt className="opacity-60">Instancias activas</dt>
              <dd className="font-mono">{result.instances}</dd>
            </div>
          )}
        </dl>
      )}

      {result.hints && result.hints.length > 0 && (
        <ul className="ml-6 mt-2 list-disc space-y-1 text-xs">
          {result.hints.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      )}

      {result.detail && (
        <details className="ml-6 mt-2 text-xs">
          <summary className="cursor-pointer opacity-60 hover:opacity-100">
            Detalle técnico
          </summary>
          <pre className="mt-1 overflow-x-auto rounded bg-white/70 p-2 text-[10px] text-stone-700">
            {result.detail}
          </pre>
        </details>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: WappStatus }) {
  if (status === 'connected') return <Badge variant="success">Conectado</Badge>;
  if (status === 'connecting') return <Badge variant="secondary">Esperando QR...</Badge>;
  return <Badge variant="secondary">Desconectado</Badge>;
}
