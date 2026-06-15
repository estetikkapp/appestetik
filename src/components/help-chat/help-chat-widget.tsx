'use client';

/**
 * Floating chat widget bottom-right del panel. Visible en todo el panel.
 *
 * Estados:
 *   closed   → solo el botón floating
 *   open     → panel grande con historial + input
 *   sending  → indicador "Pensando..." mientras streamea la respuesta
 *
 * Persistencia: cada mensaje se guarda en DB via /api/help-chat. Al abrir
 * el chat por primera vez en la sesión, hace GET /api/help-chat/history.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

export function HelpChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Cargar historial al abrir la primera vez
  useEffect(() => {
    if (!open || historyLoaded) return;
    void (async () => {
      try {
        const res = await fetch('/api/help-chat/history');
        const json = await res.json();
        setMessages(json.messages ?? []);
      } catch {
        // ignore
      } finally {
        setHistoryLoaded(true);
      }
    })();
  }, [open, historyLoaded]);

  // Auto-scroll al final
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sending]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setInput('');
    setSending(true);

    // Agregamos el mensaje del user al state local
    setMessages((m) => [...m, { role: 'user', content: text }]);

    // Placeholder vacío del assistant que vamos a ir llenando con el stream
    setMessages((m) => [...m, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/help-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        // Errores JSON (rate limit, validación)
        let errMsg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          errMsg = j.error ?? errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      // Stream
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('Sin response body');

      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        // Actualizar el último mensaje (assistant placeholder)
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last && last.role === 'assistant') {
            copy[copy.length - 1] = { ...last, content: accumulated };
          }
          return copy;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(msg);
      // Eliminar el placeholder vacío
      setMessages((m) => {
        const copy = [...m];
        if (copy[copy.length - 1]?.role === 'assistant' && !copy[copy.length - 1]?.content) {
          copy.pop();
        }
        return copy;
      });
    } finally {
      setSending(false);
    }
  }, [input, sending]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <>
      {/* Floating button (oculto cuando el panel está abierto) */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir chat de ayuda"
          className="group fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30 transition-all hover:bg-brand-600 hover:shadow-xl sm:bottom-6 sm:right-6"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="absolute right-full mr-3 hidden whitespace-nowrap rounded-md bg-stone-900 px-2 py-1 text-xs text-white group-hover:block">
            ¿Necesitás ayuda?
          </span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed inset-x-3 bottom-3 z-50 flex h-[75vh] max-h-[600px] flex-col rounded-2xl border border-stone-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[600px] sm:w-[380px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-100 bg-gradient-to-r from-brand-50 to-amber-50/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-900">
                  Asistente appestetika
                </p>
                <p className="text-[11px] text-stone-500">
                  Respuestas en castellano · IA
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {!historyLoaded && messages.length === 0 && (
              <div className="flex h-full items-center justify-center text-stone-400">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}

            {historyLoaded && messages.length === 0 && (
              <div className="rounded-2xl bg-stone-100 px-3 py-2.5 text-stone-700">
                ¡Hola! Soy tu asistente IA. Preguntame cualquier cosa sobre cómo
                usar appestetika: conectar WhatsApp, importar clientas, cobrar,
                lo que sea. Estoy para vos.
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={m.id ?? i}
                className={`max-w-[88%] rounded-2xl px-3 py-2 leading-relaxed ${
                  m.role === 'user'
                    ? 'ml-auto bg-brand-500 text-white'
                    : 'mr-auto bg-stone-100 text-stone-800'
                }`}
              >
                {m.content || (sending && i === messages.length - 1 ? (
                  <span className="inline-flex items-center gap-1.5 text-stone-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Pensando...
                  </span>
                ) : null)}
              </div>
            ))}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-stone-100 p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Escribí tu duda..."
                rows={1}
                disabled={sending}
                className="max-h-32 min-h-[40px] flex-1 resize-none text-base sm:text-sm"
              />
              <Button
                type="button"
                size="icon"
                onClick={send}
                disabled={!input.trim() || sending}
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-center text-[10px] text-stone-400">
              Las respuestas las genera IA. Verificá info importante.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
