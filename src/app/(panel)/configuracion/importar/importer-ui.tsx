'use client';

/**
 * UI del importador. State machine de 4 estados:
 *
 *   idle      → mostramos el dropzone
 *   loading   → file subido, esperando respuesta del backend
 *   review    → mostrando tabla editable + chat de corrección
 *   committing→ confirmando, llamando a /commit
 *   done      → mensaje de éxito + link a /clientas
 *
 * El state se maneja client-side. NO se persiste — si recarga la página,
 * pierde la importación en curso (le toca volver a subir el archivo).
 */

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Send,
  FileText,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

// ────────────────────────────────────────────────────────────────────────────
// Types (espejo del backend)
// ────────────────────────────────────────────────────────────────────────────

interface ExtractedClient {
  full_name: string;
  phone_e164: string | null;
  email: string | null;
  dni: string | null;
  birthdate: string | null;
  fitzpatrick: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | null;
  contraindications: string | null;
  notes: string | null;
  issues: string[];
}

interface ImportResult {
  clients: ExtractedClient[];
  notes: string[];
  stats: { total: number; with_phone: number; with_email: number; with_issues: number };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading'; filename: string }
  | { kind: 'review'; result: ImportResult; chat: ChatMessage[]; chatLoading: boolean }
  | { kind: 'committing' }
  | { kind: 'done'; inserted: number; duplicates: number; skipped: number };

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

interface Props {
  /**
   * URL a la que redirige el botón principal cuando termina exitosa la
   * importación. Default `/clientas`. En el flow de onboarding queremos
   * `/onboarding` para que siga al próximo paso (datos fiscales).
   */
  onCompleteHref?: string;
  /** Label del botón principal en la pantalla done. */
  onCompleteLabel?: string;
}

export function ImporterUI({
  onCompleteHref = '/clientas',
  onCompleteLabel = 'Ver clientas',
}: Props = {}) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setState({ kind: 'loading', filename: file.name });

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/import/parse', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setState({
        kind: 'review',
        result: json as ImportResult,
        chat: [
          {
            role: 'assistant',
            content: `Detecté ${json.stats.total} clientas en tu archivo. ${
              json.stats.with_issues > 0
                ? `${json.stats.with_issues} tienen algún problema (marcadas en amarillo).`
                : 'No detecté problemas raros.'
            } Revisalas, podés editarlas a mano o pedirme correcciones por acá.`,
          },
        ],
        chatLoading: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setState({ kind: 'idle' });
    }
  }

  async function handleCorrection(userMessage: string) {
    if (state.kind !== 'review') return;
    const next: State = {
      ...state,
      chat: [...state.chat, { role: 'user', content: userMessage }],
      chatLoading: true,
    };
    setState(next);

    try {
      const res = await fetch('/api/import/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previousResult: state.result,
          history: state.chat,
          userMessage,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);

      setState({
        kind: 'review',
        result: json.result,
        chat: [
          ...next.chat,
          { role: 'assistant', content: json.assistantMessage },
        ],
        chatLoading: false,
      });
    } catch (err) {
      setState({
        kind: 'review',
        result: state.result,
        chat: [
          ...next.chat,
          {
            role: 'assistant',
            content: `Disculpá, hubo un error: ${err instanceof Error ? err.message : 'desconocido'}. Probá de nuevo.`,
          },
        ],
        chatLoading: false,
      });
    }
  }

  function handleEditClient(index: number, field: keyof ExtractedClient, value: string) {
    if (state.kind !== 'review') return;
    const clients = [...state.result.clients];
    const current = clients[index];
    if (!current) return;
    const trimmed = value.trim();
    clients[index] = {
      ...current,
      [field]: trimmed === '' ? null : trimmed,
    } as ExtractedClient;
    setState({ ...state, result: { ...state.result, clients } });
  }

  function handleDeleteClient(index: number) {
    if (state.kind !== 'review') return;
    const clients = state.result.clients.filter((_, i) => i !== index);
    setState({ ...state, result: { ...state.result, clients } });
  }

  async function handleCommit() {
    if (state.kind !== 'review') return;
    setState({ kind: 'committing' });
    try {
      const res = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clients: state.result.clients }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setState({
        kind: 'done',
        inserted: json.inserted,
        duplicates: json.duplicates_merged,
        skipped: json.skipped?.length ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setState({ kind: 'idle' });
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Render por estado
  // ────────────────────────────────────────────────────────────────────────────

  if (state.kind === 'idle') {
    return (
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <FileDropzone onFile={handleFile} />
      </div>
    );
  }

  if (state.kind === 'loading') {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-12 text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-500" />
        <h3 className="mt-4 text-lg font-semibold text-stone-900">
          La IA está analizando tu archivo
        </h3>
        <p className="mt-1 text-sm text-stone-500">
          <span className="font-medium">{state.filename}</span> — esto puede tardar 20-60 segundos.
        </p>
      </div>
    );
  }

  if (state.kind === 'committing') {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-12 text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-500" />
        <h3 className="mt-4 text-lg font-semibold text-stone-900">
          Importando a tu base de clientas...
        </h3>
      </div>
    );
  }

  if (state.kind === 'done') {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h3 className="mt-4 text-xl font-bold text-emerald-900">
          ¡Importación lista!
        </h3>
        <div className="mt-4 space-y-1 text-sm text-emerald-800">
          <p>
            <strong>{state.inserted}</strong> clientas importadas
          </p>
          {state.duplicates > 0 && (
            <p>
              {state.duplicates} ya existían (se omitieron para evitar duplicados)
            </p>
          )}
          {state.skipped > 0 && (
            <p>{state.skipped} sin nombre (descartadas)</p>
          )}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={() => router.push(onCompleteHref)}>{onCompleteLabel}</Button>
          <Button variant="outline" onClick={() => setState({ kind: 'idle' })}>
            Importar otro archivo
          </Button>
        </div>
      </div>
    );
  }

  // state.kind === 'review'
  return (
    <ReviewView
      state={state}
      onEdit={handleEditClient}
      onDelete={handleDeleteClient}
      onCorrect={handleCorrection}
      onCommit={handleCommit}
      onCancel={() => setState({ kind: 'idle' })}
    />
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Dropzone
// ────────────────────────────────────────────────────────────────────────────

function FileDropzone({ onFile }: { onFile: (file: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      className={`block cursor-pointer rounded-2xl border-2 border-dashed bg-white p-6 sm:p-12 text-center transition-colors ${
        dragOver
          ? 'border-brand-500 bg-brand-50'
          : 'border-stone-300 hover:border-brand-400 hover:bg-stone-50'
      }`}
    >
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls,.csv,.pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      <Upload className="mx-auto h-12 w-12 text-stone-400" />
      <h3 className="mt-4 text-lg font-semibold text-stone-900">
        Subí tu archivo de clientas
      </h3>
      <p className="mt-1 text-sm text-stone-500">
        Excel, CSV, foto del cuaderno, captura de WhatsApp o PDF.
        <br />
        Hacé click acá o arrastrá el archivo.
      </p>
      <p className="mt-4 text-xs text-stone-400">Máximo 4 MB por archivo</p>
    </label>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Review (tabla + chat)
// ────────────────────────────────────────────────────────────────────────────

function ReviewView({
  state,
  onEdit,
  onDelete,
  onCorrect,
  onCommit,
  onCancel,
}: {
  state: Extract<State, { kind: 'review' }>;
  onEdit: (i: number, field: keyof ExtractedClient, value: string) => void;
  onDelete: (i: number) => void;
  onCorrect: (msg: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const { result, chat, chatLoading } = state;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Tabla (2/3 del ancho) */}
      <div className="space-y-4 lg:col-span-2">
        <div className="rounded-xl bg-brand-50/60 p-4 text-sm">
          <p className="font-semibold text-stone-900">
            {result.stats.total} clientas detectadas
          </p>
          <p className="mt-1 text-xs text-stone-600">
            {result.stats.with_phone} con teléfono · {result.stats.with_email} con email
            {result.stats.with_issues > 0 && (
              <span className="ml-1 text-amber-700">
                · {result.stats.with_issues} con observaciones
              </span>
            )}
          </p>
          {result.notes.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-stone-600">
              {result.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Tabla (md+) */}
        <div className="hidden overflow-x-auto rounded-xl border border-stone-200 bg-white md:block">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-3 py-2 text-left">Nombre</th>
                <th className="px-3 py-2 text-left">Teléfono</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">DNI</th>
                <th className="px-3 py-2 text-left">Notas</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {result.clients.map((c, i) => (
                <tr
                  key={i}
                  className={`border-t border-stone-100 ${
                    c.issues.length > 0 ? 'bg-amber-50/60' : ''
                  }`}
                >
                  <td className="px-3 py-2">
                    <input
                      defaultValue={c.full_name}
                      onBlur={(e) => onEdit(i, 'full_name', e.target.value)}
                      className="w-full rounded border-0 bg-transparent px-1 py-2 text-base sm:text-sm focus:bg-white focus:ring-1 focus:ring-brand-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      defaultValue={c.phone_e164 ?? ''}
                      onBlur={(e) => onEdit(i, 'phone_e164', e.target.value)}
                      placeholder="—"
                      className="w-full rounded border-0 bg-transparent px-1 py-2 text-base sm:text-sm focus:bg-white focus:ring-1 focus:ring-brand-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      defaultValue={c.email ?? ''}
                      onBlur={(e) => onEdit(i, 'email', e.target.value)}
                      placeholder="—"
                      className="w-full rounded border-0 bg-transparent px-1 py-2 text-base sm:text-sm focus:bg-white focus:ring-1 focus:ring-brand-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      defaultValue={c.dni ?? ''}
                      onBlur={(e) => onEdit(i, 'dni', e.target.value)}
                      placeholder="—"
                      className="w-full rounded border-0 bg-transparent px-1 py-2 text-base sm:text-sm focus:bg-white focus:ring-1 focus:ring-brand-500"
                    />
                  </td>
                  <td className="px-3 py-2 max-w-xs">
                    {c.contraindications && (
                      <div className="mb-1 rounded-md bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-800 ring-1 ring-red-200">
                        ⚠ {c.contraindications.split('\n').join(' · ')}
                      </div>
                    )}
                    {c.fitzpatrick && (
                      <div className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                        Fitzpatrick {c.fitzpatrick}
                      </div>
                    )}
                    <input
                      defaultValue={c.notes ?? ''}
                      onBlur={(e) => onEdit(i, 'notes', e.target.value)}
                      placeholder="—"
                      className="w-full rounded border-0 bg-transparent px-1 py-2 text-base sm:text-xs focus:bg-white focus:ring-1 focus:ring-brand-500"
                    />
                    {c.issues.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.issues.map((iss, j) => (
                          <span
                            key={j}
                            className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800"
                          >
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {iss}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onDelete(i)}
                      className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                      title="Borrar esta fila"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {result.clients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-stone-400">
                    Sin clientas para importar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Cards (mobile) */}
        <div className="space-y-3 md:hidden">
          {result.clients.map((c, i) => (
            <div
              key={i}
              className={`rounded-lg border border-stone-200 p-3 space-y-2 ${
                c.issues.length > 0 ? 'bg-amber-50/60' : 'bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1">
                  <label className="block text-[10px] font-medium uppercase tracking-wide text-stone-500">
                    Nombre
                  </label>
                  <input
                    defaultValue={c.full_name}
                    onBlur={(e) => onEdit(i, 'full_name', e.target.value)}
                    className="w-full rounded border border-stone-200 bg-white px-2 py-2 text-base sm:text-sm focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(i)}
                  className="mt-5 rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                  title="Borrar esta fila"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-medium uppercase tracking-wide text-stone-500">
                  Teléfono
                </label>
                <input
                  defaultValue={c.phone_e164 ?? ''}
                  onBlur={(e) => onEdit(i, 'phone_e164', e.target.value)}
                  placeholder="—"
                  className="w-full rounded border border-stone-200 bg-white px-2 py-2 text-base sm:text-sm focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-medium uppercase tracking-wide text-stone-500">
                  Email
                </label>
                <input
                  defaultValue={c.email ?? ''}
                  onBlur={(e) => onEdit(i, 'email', e.target.value)}
                  placeholder="—"
                  className="w-full rounded border border-stone-200 bg-white px-2 py-2 text-base sm:text-sm focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-medium uppercase tracking-wide text-stone-500">
                  DNI
                </label>
                <input
                  defaultValue={c.dni ?? ''}
                  onBlur={(e) => onEdit(i, 'dni', e.target.value)}
                  placeholder="—"
                  className="w-full rounded border border-stone-200 bg-white px-2 py-2 text-base sm:text-sm focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-medium uppercase tracking-wide text-stone-500">
                  Notas
                </label>
                {c.contraindications && (
                  <div className="rounded-md bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-800 ring-1 ring-red-200">
                    ⚠ {c.contraindications.split('\n').join(' · ')}
                  </div>
                )}
                {c.fitzpatrick && (
                  <div className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                    Fitzpatrick {c.fitzpatrick}
                  </div>
                )}
                <input
                  defaultValue={c.notes ?? ''}
                  onBlur={(e) => onEdit(i, 'notes', e.target.value)}
                  placeholder="—"
                  className="w-full rounded border border-stone-200 bg-white px-2 py-2 text-base sm:text-sm focus:ring-1 focus:ring-brand-500"
                />
                {c.issues.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.issues.map((iss, j) => (
                      <span
                        key={j}
                        className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800"
                      >
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {iss}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {result.clients.length === 0 && (
            <div className="rounded-lg border border-stone-200 bg-white px-3 py-8 text-center text-sm text-stone-400">
              Sin clientas para importar.
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-stone-100 pt-4">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onCommit} disabled={result.clients.length === 0}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Confirmar e importar {result.clients.length}
          </Button>
        </div>
      </div>

      {/* Chat (1/3) */}
      <ChatPanel
        chat={chat}
        loading={chatLoading}
        onSend={onCorrect}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Chat panel
// ────────────────────────────────────────────────────────────────────────────

function ChatPanel({
  chat,
  loading,
  onSend,
}: {
  chat: ChatMessage[];
  loading: boolean;
  onSend: (msg: string) => void;
}) {
  const [text, setText] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || loading) return;
    onSend(t);
    setText('');
  }

  return (
    <div className="flex h-[420px] lg:h-[640px] flex-col rounded-xl border border-stone-200 bg-white">
      <div className="border-b border-stone-100 p-3">
        <h3 className="text-sm font-semibold text-stone-900">Asistente IA</h3>
        <p className="text-xs text-stone-500">
          Pedile que ajuste la lista (borrar, normalizar, etc.)
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {chat.map((m, i) => (
          <div
            key={i}
            className={`max-w-[90%] rounded-2xl px-3 py-2 ${
              m.role === 'user'
                ? 'ml-auto bg-brand-500 text-white'
                : 'mr-auto bg-stone-100 text-stone-800'
            }`}
          >
            <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
          </div>
        ))}
        {loading && (
          <div className="mr-auto flex items-center gap-2 rounded-2xl bg-stone-100 px-3 py-2 text-xs text-stone-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Pensando...
          </div>
        )}
      </div>

      <form onSubmit={submit} className="border-t border-stone-100 p-3">
        <div className="flex gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit(e);
              }
            }}
            placeholder='Ej: "Borrá las filas que están vacías" o "Agregale el código 11 a los teléfonos"'
            rows={2}
            disabled={loading}
            className="flex-1 resize-none text-base sm:text-sm"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!text.trim() || loading}
            className="self-end"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

// Avoid unused-vars on FileText since we keep it for potential future use
void FileText;
