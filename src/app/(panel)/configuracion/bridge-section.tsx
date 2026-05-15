'use client';

import * as React from 'react';
import {
  Laptop,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Copy,
  QrCode,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  createBridgeToken,
  revokeBridgeToken,
  setWhatsappProviderLocalBridge,
} from '@/actions/bridge-tokens';

interface TokenState {
  status: 'starting' | 'qr_pending' | 'connecting' | 'ready' | 'disconnected';
  phone_e164: string | null;
  qr_base64: string | null;
  qr_updated_at: string | null;
  last_heartbeat_at: string | null;
  agent_version: string | null;
  agent_os: string | null;
}

interface BridgeToken {
  id: string;
  label: string;
  created_at: string;
  last_seen_at: string | null;
  state: TokenState | null;
}

interface BridgeStateResponse {
  tokens: BridgeToken[];
  commands_recent: Array<{
    id: string;
    action: string;
    status: string;
    attempts: number;
    last_error: string | null;
    created_at: string;
    processed_at: string | null;
  }>;
  pending_count: number;
}

interface Props {
  currentProvider: 'evolution' | 'cloud_api' | 'local_bridge';
  /** El plaintext del nuevo token recién generado (lo pasa el server por cookie por 60s) */
  newTokenPlaintext: string | null;
  /** Reservado para futuro: confirmación de qué token fue el recién creado para resaltarlo */
  newTokenId: string | null;
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://estetikkapp.com';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function BridgeSection({ currentProvider, newTokenPlaintext, newTokenId }: Props) {
  const [data, setData] = React.useState<BridgeStateResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [copied, setCopied] = React.useState(false);

  // Auto-poll del estado cada 2.5s (más rápido durante QR pending)
  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const res = await fetch('/api/bridge/state');
        const json = (await res.json()) as BridgeStateResponse;
        if (!cancelled) setData(json);
      } catch {
        // silencioso
      } finally {
        if (!cancelled) setLoading(false);
        if (!cancelled) {
          // Polling más rápido si hay un QR pendiente (la dueña lo está mirando)
          const hasQr = data?.tokens.some((t) => t.state?.status === 'qr_pending');
          const nextDelay = hasQr ? 1500 : 4000;
          timer = setTimeout(tick, nextDelay);
        }
      }
    }
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeToken = data?.tokens.find((t) => t.state?.status === 'ready');
  const qrToken = data?.tokens.find((t) => t.state?.status === 'qr_pending' && t.state.qr_base64);
  const isBridgeActive = currentProvider === 'local_bridge';

  async function copyToken() {
    if (!newTokenPlaintext) return;
    try {
      await navigator.clipboard.writeText(newTokenPlaintext);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Laptop className="h-5 w-5 text-brand-600" />
            Agente local — la opción más simple
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Instalás un mini-programa en la PC del consultorio, escaneás el QR
            una vez con WhatsApp y los recordatorios se mandan desde tu propio
            número. Gratis, sin Meta Business.
          </p>
        </div>
        <StatusBadge
          isActiveProvider={isBridgeActive}
          activeToken={activeToken}
          loading={loading}
        />
      </div>

      {/* Banner cuando recién se generó un token nuevo */}
      {newTokenPlaintext && (
        <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="font-semibold text-emerald-900">
              Token generado — copialo ahora, no se vuelve a mostrar
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white p-2">
            <code className="flex-1 break-all font-mono text-xs text-stone-700">
              {newTokenPlaintext}
            </code>
            <Button size="sm" variant={copied ? 'default' : 'outline'} onClick={copyToken}>
              {copied ? (
                <>
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Copiado
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3" /> Copiar
                </>
              )}
            </Button>
          </div>
          <p className="mt-2 text-xs text-emerald-800">
            <strong>Próximo paso:</strong> abrí el agente local en tu PC, pegá este
            código y dale &quot;Conectar&quot;. Después escaneás el QR que aparece acá abajo.
          </p>
        </div>
      )}

      {/* Setup paso a paso si no hay bridge activo */}
      {!activeToken && !qrToken && (
        <div className="rounded-xl border border-stone-200 bg-stone-50/40 p-4">
          <h3 className="mb-3 text-sm font-semibold text-stone-900">Setup en 3 pasos</h3>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-stone-700">
            <li>
              <strong>Descargá el agente</strong> para Windows, Mac o Linux desde{' '}
              <a href="/agente" className="text-brand-600 underline">
                {APP_URL}/agente
              </a>
              . Es un archivo de ~80MB. Doble click e instalá.
            </li>
            <li>
              <strong>Generá un código de vinculación</strong> abajo, copialo y pegalo
              en el agente cuando te lo pida.
            </li>
            <li>
              <strong>Escaneá el QR</strong> que aparece acá con tu WhatsApp (Dispositivos
              vinculados → Vincular dispositivo). Una vez conectado, ya manda recordatorios solo.
            </li>
          </ol>
        </div>
      )}

      {/* Link a descarga siempre visible (también cuando ya hay bridge activo,
          por si la dueña quiere instalar el agente en una segunda PC o
          reinstalar). */}
      {(activeToken || qrToken) && (
        <div className="rounded-lg border border-stone-200 bg-stone-50/40 px-3 py-2 text-xs text-stone-600">
          ¿Necesitás instalar el agente en otra PC o reinstalar? →{' '}
          <a href="/agente" className="font-medium text-brand-600 underline">
            Descargar appestetika bridge
          </a>
        </div>
      )}

      {/* QR realtime cuando el agente está pidiendo escaneo */}
      {qrToken?.state?.qr_base64 && (
        <div className="rounded-xl border-2 border-brand-300 bg-brand-50/40 p-6 text-center">
          <div className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-brand-800">
            <QrCode className="h-4 w-4" />
            Escaneá con WhatsApp del celular
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              qrToken.state.qr_base64.startsWith('data:')
                ? qrToken.state.qr_base64
                : `data:image/png;base64,${qrToken.state.qr_base64}`
            }
            alt="QR para vincular WhatsApp"
            className="mx-auto h-64 w-64 rounded-lg border border-stone-200 bg-white p-2"
          />
          <p className="mt-3 text-xs text-stone-600">
            WhatsApp → Configuración → Dispositivos vinculados → Vincular dispositivo
          </p>
          <p className="mt-1 text-[10px] text-stone-400">
            El QR se renueva automáticamente cada ~20 segundos
          </p>
        </div>
      )}

      {/* Lista de tokens (bridges configurados) */}
      {data && data.tokens.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-stone-900">Agentes vinculados</h3>
          {data.tokens.map((t) => (
            <TokenRow key={t.id} token={t} />
          ))}
        </div>
      )}

      {/* Stats si hay actividad */}
      {data && (data.pending_count > 0 || data.commands_recent.length > 0) && (
        <div className="space-y-2 rounded-lg border border-stone-100 bg-stone-50/50 p-3 text-xs text-stone-600">
          <div>
            <strong>{data.pending_count}</strong> mensajes pendientes en cola.
          </div>
          {data.commands_recent.length > 0 && (
            <div className="space-y-1">
              <div className="font-medium text-stone-700">Últimos comandos:</div>
              <ul className="space-y-1">
                {data.commands_recent.slice(0, 5).map((c) => (
                  <li key={c.id} className="flex flex-col gap-0.5 rounded bg-white px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={
                          c.status === 'sent'
                            ? 'font-medium text-emerald-700'
                            : c.status === 'failed'
                              ? 'font-medium text-red-700'
                              : 'text-stone-500'
                        }
                      >
                        {c.action} · {c.status}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {new Date(c.created_at).toLocaleTimeString('es-AR')}
                        {c.attempts > 0 && ` · ${c.attempts} intentos`}
                      </span>
                    </div>
                    {c.last_error && (
                      <div className="break-all text-[11px] text-red-600">
                        <span className="font-medium">Error:</span> {c.last_error}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Acciones */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-4">
        <CreateTokenDialog tokenJustCreated={Boolean(newTokenPlaintext)} />
        <div className="flex items-center gap-2">
          {!isBridgeActive && data && data.tokens.length > 0 && (
            <form action={setWhatsappProviderLocalBridge}>
              <SubmitButton size="sm" variant="outline">
                Activar agente local como provider
              </SubmitButton>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  isActiveProvider,
  activeToken,
  loading,
}: {
  isActiveProvider: boolean;
  activeToken: BridgeToken | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Badge variant="secondary">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Cargando...
      </Badge>
    );
  }
  if (!isActiveProvider) {
    return <Badge variant="outline">Provider no activo</Badge>;
  }
  if (activeToken) {
    return (
      <Badge variant="success">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Conectado · {activeToken.state?.phone_e164}
      </Badge>
    );
  }
  return <Badge variant="secondary">Esperando agente...</Badge>;
}

function TokenRow({ token }: { token: BridgeToken }) {
  const state = token.state;
  const lastSeen = state?.last_heartbeat_at
    ? new Date(state.last_heartbeat_at)
    : token.last_seen_at
      ? new Date(token.last_seen_at)
      : null;
  const seenSecondsAgo = lastSeen
    ? Math.floor((Date.now() - lastSeen.getTime()) / 1000)
    : null;
  const isStale = seenSecondsAgo !== null && seenSecondsAgo > 60;

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 bg-white p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium text-stone-900">
          <span className="truncate">{token.label}</span>
          {state?.status === 'ready' && (
            <span className="text-emerald-600">●</span>
          )}
          {state?.status === 'disconnected' && (
            <span className="text-red-500">●</span>
          )}
          {state?.status === 'qr_pending' && (
            <span className="text-amber-500">●</span>
          )}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs text-stone-500">
          {state?.phone_e164 && (
            <>
              <Phone className="inline h-3 w-3" /> {state.phone_e164} ·{' '}
            </>
          )}
          {state?.status && <>Estado: <strong>{state.status}</strong> · </>}
          {lastSeen ? (
            isStale ? (
              <span className="text-amber-600">
                Sin señal hace {Math.floor((seenSecondsAgo ?? 0) / 60)}min
              </span>
            ) : (
              <>Última señal hace {seenSecondsAgo}s</>
            )
          ) : (
            'Nunca conectado'
          )}
          {state?.agent_version && <> · v{state.agent_version}</>}
        </p>
      </div>
      <form action={revokeBridgeToken}>
        <input type="hidden" name="id" value={token.id} />
        <SubmitButton
          variant="ghost"
          size="sm"
          title="Revocar token (el agente quedará deslogueado)"
          aria-label={`Revocar token ${token.label}`}
          hideSpinner
        >
          <Trash2 className="h-4 w-4 text-red-600" />
        </SubmitButton>
      </form>
    </div>
  );
}

function CreateTokenDialog({ tokenJustCreated }: { tokenJustCreated: boolean }) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (tokenJustCreated) setOpen(false);
  }, [tokenJustCreated]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Generar código de vinculación</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular un agente nuevo</DialogTitle>
          <DialogDescription>
            Cada agente (cada PC donde corra appestetika-bridge) necesita su propio
            código. Ponele un nombre descriptivo para identificarlo.
          </DialogDescription>
        </DialogHeader>
        <form action={createBridgeToken} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bridge_label">Nombre / identificación</Label>
            <Input
              id="bridge_label"
              name="label"
              placeholder="Ej. PC del consultorio, PC recepción..."
              maxLength={60}
            />
            <p className="text-xs text-stone-500">
              Solo para identificarlo en este panel. Si tenés una sola PC, podés
              dejar el default.
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            El código se va a mostrar <strong>UNA SOLA VEZ</strong>. Copialo en el momento
            y pegalo en el agente.
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pendingText="Generando...">Generar código</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
