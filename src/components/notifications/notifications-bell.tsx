'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell, BellDot, Check, CheckCheck } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr}h`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `hace ${d}d`;
  return new Date(iso).toLocaleDateString('es-AR');
}

export function NotificationsBell({ userId }: { userId: string }) {
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [unread, setUnread] = React.useState(0);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
      setUnread(data.unread_count ?? 0);
    } catch {
      // ignore
    }
  }, []);

  // Initial load + polling fallback espaciado (5min) — el realtime subscription
  // de abajo cubre la mayoría de los casos. El polling es un safety net para
  // cuando la conexión WS muere silenciosamente. 60s era demasiado agresivo
  // (60req/h × usuarias logueadas).
  React.useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5 * 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Realtime subscription
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_all_read' }),
    });
    refresh();
  }

  async function markOneRead(id: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', id }),
    });
    refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          title="Notificaciones"
          aria-label={
            unread > 0
              ? `Notificaciones (${unread} sin leer)`
              : 'Notificaciones'
          }
        >
          {unread > 0 ? (
            <BellDot className="h-5 w-5 text-brand-600" aria-hidden="true" />
          ) : (
            <Bell className="h-5 w-5 text-stone-500" aria-hidden="true" />
          )}
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-medium text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-semibold">Notificaciones</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto border-t border-stone-100">
          {items.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-stone-400">Sin notificaciones</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`px-3 py-2 ${!n.read_at ? 'bg-brand-50/40' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      {n.link ? (
                        <Link
                          href={n.link}
                          onClick={() => markOneRead(n.id)}
                          className="block hover:text-brand-700"
                        >
                          <p className="text-sm font-medium text-stone-900">{n.title}</p>
                          {n.body && <p className="text-xs text-stone-600">{n.body}</p>}
                        </Link>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-stone-900">{n.title}</p>
                          {n.body && <p className="text-xs text-stone-600">{n.body}</p>}
                        </>
                      )}
                      <p className="mt-1 text-[10px] text-stone-400">{relativeTime(n.created_at)}</p>
                    </div>
                    {!n.read_at && (
                      <button
                        type="button"
                        onClick={() => markOneRead(n.id)}
                        className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                        title="Marcar como leída"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
