'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { DeleteConfirmButton } from '@/components/ui/delete-confirm-button';
import { deleteTreatmentSession } from '@/actions/treatment-sessions';
import { formatDateTimeAr } from '@/lib/utils/dates';

interface SessionWithService {
  id: string;
  performed_at: string;
  parameters: unknown;
  photos_before_urls: string[];
  photos_after_urls: string[];
  products_used: string | null;
  notes: string | null;
  service: { name: string } | { name: string }[] | null;
}

export function TreatmentSessionRow({
  session,
}: {
  session: SessionWithService;
  clientId?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const svc = Array.isArray(session.service) ? session.service[0] : session.service;
  const params = (session.parameters && typeof session.parameters === 'object'
    ? (session.parameters as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  return (
    <div className="rounded-xl border border-stone-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-brand-50/30"
      >
        <div>
          <div className="font-medium">{svc?.name ?? 'Sesión'}</div>
          <p className="text-xs text-stone-500">{formatDateTimeAr(session.performed_at)}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-400">
          {session.photos_before_urls.length > 0 && (
            <span>📷 {session.photos_before_urls.length + session.photos_after_urls.length}</span>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t border-stone-100 p-4">
          {Object.keys(params).length > 0 && (
            <div className="text-xs">
              <p className="font-medium text-stone-700">Parámetros</p>
              <pre className="mt-1 overflow-x-auto rounded bg-stone-50 p-2 text-stone-600">
                {JSON.stringify(params, null, 2)}
              </pre>
            </div>
          )}
          {session.products_used && (
            <div className="text-xs">
              <p className="font-medium text-stone-700">Productos usados</p>
              <p className="text-stone-600">{session.products_used}</p>
            </div>
          )}
          {session.notes && (
            <div className="text-xs">
              <p className="font-medium text-stone-700">Notas</p>
              <p className="whitespace-pre-wrap text-stone-600">{session.notes}</p>
            </div>
          )}
          {(session.photos_before_urls.length > 0 || session.photos_after_urls.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {session.photos_before_urls.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-stone-700">Antes</p>
                  <div className="flex gap-2 overflow-x-auto">
                    {session.photos_before_urls.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={url}
                        alt={`Antes ${i + 1}`}
                        className="h-24 w-24 shrink-0 rounded border border-stone-200 object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}
              {session.photos_after_urls.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-stone-700">Después</p>
                  <div className="flex gap-2 overflow-x-auto">
                    {session.photos_after_urls.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={url}
                        alt={`Después ${i + 1}`}
                        className="h-24 w-24 shrink-0 rounded border border-stone-200 object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end pt-2">
            <DeleteConfirmButton
              action={deleteTreatmentSession}
              id={session.id}
              itemLabel="esta sesión"
              description="Esta acción borra la sesión y sus fotos. No se puede deshacer."
              iconOnly={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
