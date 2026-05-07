'use client';

import * as React from 'react';
import { Mail, AlertTriangle, CheckCircle2, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DomainCheck {
  config: {
    api_key_present: boolean;
    from_email: string | null;
    from_domain: string | null;
  };
  domain: {
    status: 'verified' | 'pending' | 'failed' | 'not_found' | 'unknown' | null;
    verified: boolean;
    auth_failed: boolean;
  };
  detail: string | null;
  hints: string[];
}

interface SendResult {
  ok: boolean;
  sent_to?: string;
  message_id?: string | null;
  error?: string | null;
  code?: string | null;
  elapsed_ms?: number;
  hints?: string[];
}

export function EmailTestSection() {
  const [check, setCheck] = React.useState<DomainCheck | null>(null);
  const [checking, setChecking] = React.useState(true);
  const [send, setSend] = React.useState<SendResult | null>(null);
  const [sending, setSending] = React.useState(false);

  // Auto-check domain status al montar
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/email/test');
        const data = (await res.json()) as DomainCheck;
        if (!cancelled) setCheck(data);
      } catch {
        // silencioso
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setChecking(true);
    setSend(null);
    try {
      const res = await fetch('/api/email/test');
      const data = (await res.json()) as DomainCheck;
      setCheck(data);
    } finally {
      setChecking(false);
    }
  }

  async function sendTestEmail() {
    setSending(true);
    setSend(null);
    try {
      const res = await fetch('/api/email/test', { method: 'POST' });
      const data = (await res.json()) as SendResult;
      setSend(data);
    } catch (err) {
      setSend({
        ok: false,
        error: err instanceof Error ? err.message : 'Error de red',
        hints: ['No se pudo llamar al endpoint. Recargá la página.'],
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-6">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-semibold">Email transaccional (Resend)</h2>
        {check && <StatusBadge check={check} />}
      </div>
      <p className="mb-4 text-sm text-stone-500">
        Confirmaciones de reserva online, recordatorios fallback de WhatsApp, e
        invitaciones a empleadas.
      </p>

      {checking && !check && (
        <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chequeando configuración...
        </div>
      )}

      {check && <ConfigPanel check={check} />}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={checking}
        >
          {checking ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Mail className="mr-1 h-3 w-3" />
          )}
          Recheckar configuración
        </Button>
        <Button
          size="sm"
          onClick={sendTestEmail}
          disabled={sending || !check?.config.api_key_present}
        >
          {sending ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Send className="mr-1 h-3 w-3" />
          )}
          Enviarme un test a mi email
        </Button>
      </div>

      {send && <SendPanel result={send} />}
    </section>
  );
}

function StatusBadge({ check }: { check: DomainCheck }) {
  if (!check.config.api_key_present) {
    return (
      <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-700">
        Sin configurar
      </span>
    );
  }
  if (check.domain.auth_failed) {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        API key inválida
      </span>
    );
  }
  if (check.domain.verified) {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        ✓ Operativo
      </span>
    );
  }
  if (check.domain.status === 'pending') {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        Pendiente DNS
      </span>
    );
  }
  return (
    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
      ✗ {check.domain.status === 'not_found' ? 'Dominio no agregado' : 'Falla'}
    </span>
  );
}

function ConfigPanel({ check }: { check: DomainCheck }) {
  return (
    <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/40 p-3">
      <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
        <div>
          <dt className="opacity-60">API key</dt>
          <dd className="font-mono">
            {check.config.api_key_present ? '✓ presente' : '✗ falta'}
          </dd>
        </div>
        <div>
          <dt className="opacity-60">From email</dt>
          <dd className="font-mono break-all">
            {check.config.from_email ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="opacity-60">Dominio en Resend</dt>
          <dd className="font-mono">
            {check.domain.status ?? 'desconocido'}
          </dd>
        </div>
      </dl>
      {check.detail && (
        <details className="text-xs">
          <summary className="cursor-pointer opacity-60 hover:opacity-100">
            Detalle técnico
          </summary>
          <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-[10px]">
            {check.detail}
          </pre>
        </details>
      )}
      {check.hints.length > 0 && (
        <ul className="list-disc space-y-1 pl-4 text-xs text-stone-700">
          {check.hints.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SendPanel({ result }: { result: SendResult }) {
  return (
    <div
      className={`mt-3 rounded-xl border p-3 text-sm ${
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
            {result.ok
              ? `Email enviado a ${result.sent_to ?? '—'}`
              : 'No se pudo enviar el email'}
            {result.elapsed_ms !== undefined && (
              <span className="ml-2 text-xs font-normal opacity-70">
                {result.elapsed_ms}ms
              </span>
            )}
          </p>
          {result.ok && (
            <p className="mt-0.5 text-xs">
              Si no llegó en 1-2 min, revisá la carpeta de spam.{' '}
              {result.message_id && (
                <span className="font-mono opacity-70">id: {result.message_id}</span>
              )}
            </p>
          )}
          {!result.ok && result.error && (
            <p className="mt-0.5 text-xs">
              {result.error} {result.code && <span className="opacity-70">[{result.code}]</span>}
            </p>
          )}
        </div>
      </div>

      {result.hints && result.hints.length > 0 && (
        <ul className="ml-6 list-disc space-y-1 text-xs">
          {result.hints.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
