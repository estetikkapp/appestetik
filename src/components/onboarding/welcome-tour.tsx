'use client';

/**
 * Welcome tour del panel — popups secuenciales que muestran las features
 * principales a una user nueva. Se monta en el panel layout y solo dispara
 * si el server pasa enabled=true (owner + tour_completed_at NULL).
 *
 * Decisiones del owner:
 *   - Solo para `owner` role (las empleadas aprenden de la dueña o de /ayuda)
 *   - Dispara en la primera visita al dashboard `/`
 *   - 6 stops máximo (más de 8 y la gente skipea)
 *   - Estado persistido en DB: memberships.tour_completed_at
 *   - Botón "Ver tour" en /configuracion para volver a verlo
 */

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Joyride,
  STATUS,
  ACTIONS,
  type Step,
  type EventData,
  type Options,
  type Styles,
} from 'react-joyride';
import { markTourCompletedAction } from '@/actions/tour';

interface Props {
  /** Server pasa true si owner activo + nunca completó el tour. */
  enabled: boolean;
}

// Los selectores apuntan a [data-tour="<id>"] que están seteados en Sidebar.
// Si en el futuro queremos agregar un stop sobre un botón específico (ej.
// "Compartir link"), basta con agregar el data-tour ahí + un step nuevo acá.
const STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: 'Bienvenida a appestetika',
    content:
      '¡Hola! En 1 minuto te muestro las 5 cosas que tenés que conocer para arrancar. Si querés saltearlo, dale a "Salir del tour" — siempre podés volver a verlo desde Configuración.',
    skipBeacon: true,
    buttons: ['skip', 'primary'],
  },
  {
    target: '[data-tour="agenda"]',
    title: 'Tu agenda',
    content:
      'Acá vas a ver todos tus turnos: por día, por semana o por mes. Desde adentro también podés copiar tu link público para que tus clientas reserven solas.',
    placement: 'right',
    skipBeacon: true,
    buttons: ['skip', 'back', 'primary'],
  },
  {
    target: '[data-tour="clientas"]',
    title: 'Tus clientas',
    content:
      'Tu base de pacientes con ficha clínica, historial, fotos antes/después y consentimientos firmados. Cada turno suma datos a la ficha.',
    placement: 'right',
    skipBeacon: true,
    buttons: ['skip', 'back', 'primary'],
  },
  {
    target: '[data-tour="servicios"]',
    title: 'Catálogo de servicios',
    content:
      'Acá cargás los tratamientos que ofrecés con precio, duración y buffer. Esto define qué pueden reservar tus clientas online.',
    placement: 'right',
    skipBeacon: true,
    buttons: ['skip', 'back', 'primary'],
  },
  {
    target: '[data-tour="configuracion"]',
    title: 'Conectá WhatsApp',
    content:
      'En Configuración → "Agente local" generás un código y descargás un programa para tu PC. Una vez conectado, los recordatorios salen automáticos desde tu WhatsApp. Sin Meta Business, sin trucos.',
    placement: 'right',
    skipBeacon: true,
    buttons: ['skip', 'back', 'primary'],
  },
  {
    target: '[data-tour="ayuda"]',
    title: 'Listo',
    content:
      '¡Eso es todo! Si tenés dudas, en "Ayuda" hay tutoriales paso a paso de cada feature. Cualquier consulta, escribinos a hola@estetikkapp.com. Buena suerte.',
    placement: 'right',
    skipBeacon: true,
    buttons: ['back', 'primary'],
  },
];

// Defaults globales (paleta brand)
const TOUR_OPTIONS: Partial<Options> = {
  primaryColor: '#a85f58', // brand-700
  backgroundColor: '#ffffff',
  arrowColor: '#ffffff',
  overlayColor: 'rgba(28, 25, 23, 0.5)', // stone-900/50
  textColor: '#1c1917', // stone-900
  zIndex: 10000,
  showProgress: true,
};

// Overrides finos de CSS (radio, padding, etc.). Partial — solo overridemos
// los slots que nos importan; los demás usan el default de Joyride.
const TOUR_STYLES: Partial<Styles> = {
  tooltip: {
    borderRadius: 16,
    padding: 20,
    boxShadow: '0 20px 50px -10px rgba(0,0,0,0.25)',
    fontFamily: 'inherit',
  },
  tooltipTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 8,
    color: '#1c1917',
  },
  tooltipContent: {
    fontSize: 14,
    lineHeight: 1.55,
    color: '#57534e', // stone-600
    padding: '8px 0',
  },
  buttonPrimary: {
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    padding: '8px 16px',
  },
  buttonBack: {
    color: '#78716c',
    fontSize: 14,
    marginRight: 8,
  },
  buttonSkip: {
    color: '#78716c',
    fontSize: 13,
  },
};

export function WelcomeTour({ enabled }: Props) {
  const pathname = usePathname();
  const [run, setRun] = useState(false);

  // Joyride necesita que esté montado en cliente y los targets en el DOM.
  // Damos un pequeño delay para asegurar la hidratación.
  useEffect(() => {
    if (!enabled) return;
    // Solo arranca en el dashboard. Si la primera vista no fue `/`, esperamos.
    if (pathname !== '/') return;
    const t = setTimeout(() => setRun(true), 600);
    return () => clearTimeout(t);
  }, [enabled, pathname]);

  function handleEvent(data: EventData) {
    const { status, action } = data;
    const finished =
      status === STATUS.FINISHED || status === STATUS.SKIPPED;
    const closed = action === ACTIONS.CLOSE;

    if (finished || closed) {
      setRun(false);
      // Fire-and-forget. No bloquea UX si falla.
      void markTourCompletedAction().catch((err) => {
        console.warn('[tour] markTourCompleted failed:', err);
      });
    }
  }

  if (!enabled) return null;

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      scrollToFirstStep
      options={TOUR_OPTIONS}
      styles={TOUR_STYLES}
      locale={{
        back: 'Anterior',
        close: 'Cerrar',
        last: 'Listo',
        next: 'Siguiente',
        skip: 'Salir del tour',
      }}
      onEvent={handleEvent}
    />
  );
}
