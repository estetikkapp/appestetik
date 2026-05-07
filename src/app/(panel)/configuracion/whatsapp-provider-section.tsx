'use client';

import * as React from 'react';
import { Cloud, MessageCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import { saveWhatsappCloudConfig } from '@/actions/whatsapp-cloud-config';

interface Props {
  currentProvider: 'evolution' | 'cloud_api';
  cloudConfig: {
    phone_number_id?: string;
    business_account_id?: string;
    access_token?: string;
    verify_token?: string;
  } | null;
  webhookUrl: string;
}

export function WhatsappProviderSection({ currentProvider, cloudConfig, webhookUrl }: Props) {
  const [provider, setProvider] = React.useState<'evolution' | 'cloud_api'>(currentProvider);

  return (
    <div className="space-y-4 rounded-xl border border-stone-200 bg-stone-50/50 p-4">
      <div>
        <h3 className="text-sm font-semibold text-stone-900">Proveedor de WhatsApp</h3>
        <p className="mt-0.5 text-xs text-stone-500">
          Elegí cómo se conecta tu centro a WhatsApp. Podés cambiar en cualquier momento.
        </p>
      </div>

      <form action={saveWhatsappCloudConfig} className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <ProviderRadio
            value="evolution"
            current={provider}
            onChange={setProvider}
            icon={MessageCircle}
            title="Evolution (Baileys)"
            description="Vinculás tu WhatsApp personal escaneando QR. Gratis pero depende de IP — puede fallar si Meta la bloquea (común en datacenters)."
            badge="Gratis"
            badgeColor="emerald"
          />
          <ProviderRadio
            value="cloud_api"
            current={provider}
            onChange={setProvider}
            icon={Cloud}
            title="Meta Cloud API (oficial)"
            description="Canal oficial de Meta. Requiere número WhatsApp Business y cuenta Meta Business. 1000 conversaciones gratis/mes."
            badge="Recomendado"
            badgeColor="brand"
          />
        </div>

        {provider === 'cloud_api' && (
          <div className="space-y-3 rounded-lg border border-brand-200 bg-white p-4">
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <div>
                <p className="font-semibold">Cómo conseguir las credenciales</p>
                <ol className="ml-4 mt-1 list-decimal space-y-0.5">
                  <li>
                    En{' '}
                    <a
                      href="https://developers.facebook.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      developers.facebook.com
                    </a>{' '}
                    → tu App → Productos → WhatsApp → API Setup
                  </li>
                  <li>
                    <strong>Phone Number ID</strong> y <strong>Business Account ID</strong>{' '}
                    aparecen ahí (números largos)
                  </li>
                  <li>
                    <strong>Access Token</strong>: para producción usá uno permanente generado
                    desde Meta Business → Configuración → System Users (no el temporal de 24h)
                  </li>
                  <li>
                    <strong>Verify Token</strong>: poné cualquier secreto random; lo usás también
                    al configurar el webhook
                  </li>
                </ol>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="phone_number_id">Phone Number ID *</Label>
                <Input
                  id="phone_number_id"
                  name="phone_number_id"
                  defaultValue={cloudConfig?.phone_number_id ?? ''}
                  placeholder="123456789012345"
                  required={provider === 'cloud_api'}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="business_account_id">Business Account ID</Label>
                <Input
                  id="business_account_id"
                  name="business_account_id"
                  defaultValue={cloudConfig?.business_account_id ?? ''}
                  placeholder="123456789012345"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="access_token">Access Token *</Label>
              <Input
                id="access_token"
                name="access_token"
                type="password"
                defaultValue={cloudConfig?.access_token ?? ''}
                placeholder="EAAXxxxx..."
                required={provider === 'cloud_api'}
              />
              <p className="text-[10px] text-stone-500">
                Se guarda cifrado. Solo owner/admin puede verlo.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="verify_token">Verify Token (opcional, para webhook)</Label>
              <Input
                id="verify_token"
                name="verify_token"
                defaultValue={cloudConfig?.verify_token ?? ''}
                placeholder="cualquier_secreto_random"
              />
            </div>

            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs">
              <p className="font-semibold text-stone-700">Webhook URL para Meta</p>
              <p className="mt-1 break-all font-mono text-stone-600">{webhookUrl}</p>
              <p className="mt-1 text-stone-500">
                Pegá esta URL en developers.facebook.com → tu App → WhatsApp → Configuration →
                Webhook. Subscribite a los eventos <code>messages</code> y{' '}
                <code>message_status</code>.
              </p>
            </div>
          </div>
        )}

        <input type="hidden" name="provider" value={provider} />
        <div className="flex justify-end">
          <SubmitButton size="sm" pendingText="Guardando...">
            {provider === 'cloud_api' && cloudConfig?.phone_number_id ? (
              <>
                <CheckCircle2 className="mr-1 h-3 w-3" /> Actualizar Cloud API
              </>
            ) : provider === 'cloud_api' ? (
              <>Guardar y conectar Cloud API</>
            ) : (
              <>Cambiar a Evolution</>
            )}
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

interface ProviderRadioProps {
  value: 'evolution' | 'cloud_api';
  current: 'evolution' | 'cloud_api';
  onChange: (v: 'evolution' | 'cloud_api') => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  badge: string;
  badgeColor: 'emerald' | 'brand';
}

function ProviderRadio({
  value,
  current,
  onChange,
  icon: Icon,
  title,
  description,
  badge,
  badgeColor,
}: ProviderRadioProps) {
  const isActive = current === value;
  const badgeClass =
    badgeColor === 'emerald'
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-brand-100 text-brand-700';
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`flex flex-col items-start gap-2 rounded-lg border-2 p-3 text-left transition-colors ${
        isActive ? 'border-brand-400 bg-brand-50/40' : 'border-stone-200 bg-white hover:border-brand-200'
      }`}
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-stone-700" />
          <span className="text-sm font-medium text-stone-900">{title}</span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}>
          {badge}
        </span>
      </div>
      <p className="text-xs text-stone-600">{description}</p>
    </button>
  );
}
