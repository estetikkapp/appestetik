import Link from 'next/link';
import {
  Calendar,
  MessageCircle,
  CreditCard,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Users,
  Receipt,
  FileText,
  Camera,
  Package,
  Clock,
  ShieldCheck,
  Globe,
  Smartphone,
  ChevronDown,
} from 'lucide-react';

export const metadata = {
  title: 'appestetika — Gestión completa para tu centro de estética',
  description:
    'Agenda, reservas online, WhatsApp automático, cobros, AFIP y ficha clínica con IA. Sin tarjeta, sin contrato. Hecho en Argentina.',
};

export default function InicioPage() {
  return (
    <>
      <Hero />
      <ValueProps />
      <HowItWorks />
      <FeaturesGrid />
      <Trust />
      <PricingTeaser />
      <Faq />
      <FinalCta />
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Hero
// ────────────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 md:grid-cols-2 md:items-center md:py-28">
        <div>
          <h1 className="text-4xl font-bold leading-tight text-stone-900 sm:text-5xl">
            Tu centro de estética,{' '}
            <span className="text-brand-600">manejado en un solo lugar.</span>
          </h1>
          <p className="mt-5 text-lg text-stone-600">
            Agenda, reservas online, recordatorios automáticos por WhatsApp,
            cobros con Mercado Pago, facturación AFIP, ficha clínica de
            pacientes y análisis de piel con IA. Todo desde una sola app, en
            castellano, pensada para Argentina.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-600"
            >
              Probar 30 días gratis
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/precios"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-stone-300 px-6 py-3 text-base font-medium text-stone-800 hover:border-stone-400"
            >
              Ver precios
            </Link>
          </div>

          <p className="mt-4 text-sm text-stone-500">
            Sin tarjeta. Sin contrato. Pagás cuando te convence.
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-lg">
          <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-amber-400" />
            <div className="h-3 w-3 rounded-full bg-emerald-400" />
            <span className="ml-2 text-xs text-stone-500">tu agenda hoy</span>
          </div>

          <div className="mt-4 space-y-3">
            <AppointmentRow
              time="09:30"
              client="María Fernández"
              service="Limpieza profunda"
              duration="60 min"
              status="confirmed"
            />
            <AppointmentRow
              time="11:00"
              client="Lucía Pérez"
              service="Botox frente"
              duration="30 min"
              status="confirmed"
            />
            <AppointmentRow
              time="12:00"
              client="Sofía Ruiz"
              service="Masaje relajante"
              duration="90 min"
              status="pending"
            />
            <AppointmentRow
              time="15:00"
              client="Carla Méndez"
              service="Diseño de cejas"
              duration="45 min"
              status="confirmed"
            />
          </div>

          <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
            <div className="flex items-center gap-2 font-medium">
              <MessageCircle className="h-3.5 w-3.5" />
              Recordatorio enviado por WhatsApp a 4 clientas
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AppointmentRow({
  time,
  client,
  service,
  duration,
  status,
}: {
  time: string;
  client: string;
  service: string;
  duration: string;
  status: 'confirmed' | 'pending';
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-stone-100 p-3">
      <div className="w-12 shrink-0 text-sm font-semibold text-stone-900">{time}</div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-stone-900">{client}</p>
        <p className="truncate text-xs text-stone-500">
          {service} · {duration}
        </p>
      </div>
      {status === 'confirmed' ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      ) : (
        <Clock className="h-4 w-4 text-amber-500" />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Value props
// ────────────────────────────────────────────────────────────────────────────

function ValueProps() {
  const props = [
    {
      icon: Calendar,
      title: 'Nunca más turnos a mano',
      text: 'Reservas online que tus clientas hacen solas desde su celular. Tu agenda se llena mientras dormís.',
    },
    {
      icon: MessageCircle,
      title: 'WhatsApp automático',
      text: 'Recordatorios 24h antes del turno. Menos no-shows, menos llamadas para confirmar.',
    },
    {
      icon: CreditCard,
      title: 'Cobros + AFIP',
      text: 'Mercado Pago integrado para señas. Factura electrónica AFIP automática al finalizar el servicio.',
    },
    {
      icon: Sparkles,
      title: 'IA que recomienda',
      text: 'Análisis de piel con foto y protocolos de tratamiento sugeridos por IA. Como tener una asistente experta.',
    },
  ];
  return (
    <section className="border-t border-stone-100 py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {props.map((p) => (
            <div key={p.title}>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <p.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-stone-900">{p.title}</h3>
              <p className="mt-2 text-sm text-stone-600">{p.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// How it works
// ────────────────────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section className="bg-stone-50 py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-stone-900">Empezás en minutos</h2>
          <p className="mt-3 text-base text-stone-600">
            Sin instalaciones complicadas ni capacitaciones largas. Te registrás
            y arrancás el mismo día.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          <Step
            n={1}
            icon={Globe}
            title="Te registrás"
            text="30 segundos. Solo tu email y un nombre para tu centro. Sin tarjeta de crédito."
          />
          <Step
            n={2}
            icon={Calendar}
            title="Cargás tus servicios"
            text="Tus precios, tus duraciones, tus horarios de atención. Te ayudamos paso a paso."
          />
          <Step
            n={3}
            icon={Users}
            title="Empezás a recibir reservas"
            text="Compartís tu link de reservas en Instagram o WhatsApp. Las clientas eligen solas."
          />
        </div>
      </div>
    </section>
  );
}

function Step({
  n,
  icon: Icon,
  title,
  text,
}: {
  n: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
          {n}
        </span>
        <Icon className="h-5 w-5 text-stone-400" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-stone-900">{title}</h3>
      <p className="mt-2 text-sm text-stone-600">{text}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Features grid
// ────────────────────────────────────────────────────────────────────────────

function FeaturesGrid() {
  const features = [
    {
      icon: Calendar,
      title: 'Agenda visual',
      text: 'Vista día, semana y mes. Arrastrá para reagendar. Códigos de color por estado y profesional.',
    },
    {
      icon: Globe,
      title: 'Reservas online',
      text: 'Tu link público (estetikkapp.com/c/tu-clinica) o widget embebido en tu web.',
    },
    {
      icon: MessageCircle,
      title: 'WhatsApp recordatorios',
      text: 'Conectás tu WhatsApp con QR. La PC del consultorio manda los avisos automáticos.',
    },
    {
      icon: Receipt,
      title: 'Facturación AFIP',
      text: 'Factura C, B, A automática al finalizar el turno. Vinculado a TusFacturas.',
    },
    {
      icon: CreditCard,
      title: 'Mercado Pago',
      text: 'Pedí seña al reservar. Cobrá en el momento con link. Conciliación automática.',
    },
    {
      icon: FileText,
      title: 'Ficha clínica',
      text: 'Historia, contraindicaciones, alergias, consentimientos firmados digitalmente.',
    },
    {
      icon: Camera,
      title: 'Fotos antes/después',
      text: 'Tracking visual del progreso de cada tratamiento. Guardadas privadas.',
    },
    {
      icon: Package,
      title: 'Paquetes prepagos',
      text: 'Vendé bonos de sesiones con descuento. Tracking de sesiones usadas/restantes.',
    },
    {
      icon: Users,
      title: 'Multi-empleada',
      text: 'Equipo con permisos por rol. Comisiones automáticas. Dashboard por empleada.',
    },
    {
      icon: Sparkles,
      title: 'IA Claude Vision',
      text: 'Subís foto de la piel y la IA te sugiere protocolo de tratamiento personalizado.',
    },
    {
      icon: ShieldCheck,
      title: 'Cancelaciones seguras',
      text: 'Las clientas cancelan con un link único y código. Ventana configurable de 24h.',
    },
    {
      icon: Smartphone,
      title: 'Andá del celu o PC',
      text: 'Funciona en cualquier dispositivo. App web responsive, sin instalar nada.',
    },
  ];

  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-stone-900">
            Todo lo que necesitás, sin complicarte
          </h2>
          <p className="mt-3 text-base text-stone-600">
            Reemplazá Excel, agendas de papel, WhatsApp Business y mil planillas
            por una sola herramienta.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-stone-100 bg-white p-6 transition-all hover:border-brand-200 hover:shadow-sm"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-stone-900">{f.title}</h3>
              <p className="mt-2 text-sm text-stone-600">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Trust
// ────────────────────────────────────────────────────────────────────────────

function Trust() {
  return (
    <section className="bg-brand-700 py-16 text-white">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-8 text-center md:grid-cols-3">
          <div>
            <p className="text-3xl font-bold">100%</p>
            <p className="mt-2 text-sm text-brand-100">
              Hecho en Argentina, pensado para nuestra realidad (AFIP, MP, pesos).
            </p>
          </div>
          <div>
            <p className="text-3xl font-bold">30 días</p>
            <p className="mt-2 text-sm text-brand-100">
              De prueba gratis. Sin tarjeta. Sin compromisos.
            </p>
          </div>
          <div>
            <p className="text-3xl font-bold">WhatsApp</p>
            <p className="mt-2 text-sm text-brand-100">
              Soporte por WhatsApp en horario AR. Hablás con personas, no con bots.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Pricing teaser
// ────────────────────────────────────────────────────────────────────────────

function PricingTeaser() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <h2 className="text-3xl font-bold text-stone-900">Precios simples y claros</h2>
        <p className="mt-3 text-base text-stone-600">
          Desde <strong>$29.990/mes</strong> para profesionales que atienden solas.{' '}
          Hasta <strong>$54.990/mes</strong> para equipos completos. Sin sorpresas.
        </p>
        <Link
          href="/precios"
          className="mt-6 inline-flex items-center gap-2 rounded-lg border-2 border-stone-300 px-6 py-3 font-medium text-stone-800 hover:border-stone-400"
        >
          Ver todos los planes
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// FAQ
// ────────────────────────────────────────────────────────────────────────────

function Faq() {
  const items = [
    {
      q: '¿Necesito tarjeta de crédito para probar?',
      a: 'No. El registro y los 30 días gratis no piden tarjeta. Al cumplirse el período, vas a poder seguir viendo lo que cargaste pero sin sumar más, hasta que decidas activar un plan.',
    },
    {
      q: '¿Cómo conecto WhatsApp?',
      a: 'Descargás un pequeño programa para tu PC (el "Agente local"), escaneás un QR con tu WhatsApp del celular y listo. Los recordatorios salen de tu propio WhatsApp Business, sin pagar templates de Meta.',
    },
    {
      q: '¿Funciona con AFIP?',
      a: 'Sí. Integramos con TusFacturas (servicio externo, ~$5k/mes según su plan) para emitir facturas C, B y A con CAE automático. Si todavía no querés facturar electrónicamente, podés emitir comprobantes internos no fiscales.',
    },
    {
      q: '¿Puedo cancelar cuando quiera?',
      a: 'Sí, sin preguntas. Cancelás desde tu panel en un click. La cuenta sigue activa hasta el fin del período pagado y después se archiva (tus datos quedan disponibles si querés volver).',
    },
    {
      q: '¿Cobran en pesos o dólares?',
      a: 'Pesos argentinos siempre. Los precios están fijos en pesos, sin indexar al dólar.',
    },
    {
      q: '¿Y si soy un centro con varias sucursales?',
      a: 'Tenemos un plan empresarial para multi-sucursal con account manager dedicado. Escribinos a hola@estetikkapp.com y armamos un plan a medida.',
    },
  ];

  return (
    <section className="border-t border-stone-100 bg-stone-50 py-20">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="text-center text-3xl font-bold text-stone-900">Preguntas frecuentes</h2>

        <div className="mt-10 space-y-3">
          {items.map((it) => (
            <FaqItem key={it.q} q={it.q} a={it.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-stone-200 bg-white">
      <summary className="flex cursor-pointer items-center justify-between p-5 text-sm font-medium text-stone-900">
        {q}
        <ChevronDown className="h-4 w-4 text-stone-400 transition-transform group-open:rotate-180" />
      </summary>
      <p className="border-t border-stone-100 p-5 text-sm text-stone-600">{a}</p>
    </details>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Final CTA
// ────────────────────────────────────────────────────────────────────────────

function FinalCta() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <h2 className="text-3xl font-bold text-stone-900 sm:text-4xl">
          Probalo 30 días gratis y decidí
        </h2>
        <p className="mt-4 text-base text-stone-600">
          Sin tarjeta. Sin contrato. Si te gusta, pagás. Si no, te vas.
        </p>
        <Link
          href="/auth/signup"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-brand-500 px-8 py-4 text-lg font-semibold text-white shadow-sm hover:bg-brand-600"
        >
          Empezar ahora
          <ArrowRight className="h-5 w-5" />
        </Link>
        <p className="mt-4 text-sm text-stone-500">
          ¿Dudas?{' '}
          <a href="mailto:hola@estetikkapp.com" className="text-brand-600 underline">
            Escribinos
          </a>{' '}
          o entrá a{' '}
          <Link href="/ayuda" className="text-brand-600 underline">
            la sección de ayuda
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
