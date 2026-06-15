import Link from 'next/link';
import {
  Calendar,
  MessageCircle,
  CreditCard,
  Sparkles,
  ArrowRight,
  Users,
  Receipt,
  FileText,
  Camera,
  Package,
  ShieldCheck,
  Globe,
  Smartphone,
  ChevronDown,
} from 'lucide-react';
import { ProbarGratisCTA } from '@/components/analytics/probar-gratis-cta';
import {
  FadeUp,
  Stagger,
  StaggerItem,
  Float,
  CountUp,
  HoverLift,
} from '@/components/motion/primitives';
import { HeroAgendaMockup } from './hero-mockup';

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
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
      {/* Blobs de fondo decorativos — sutiles, no compiten con el contenido */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-40 h-80 w-80 rounded-full bg-amber-100/40 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-14 md:grid-cols-2 md:items-center md:py-28">
        <FadeUp className="text-center md:text-left" distance={48} duration={1.0} immediate>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-1 text-xs font-medium text-brand-700 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Hecho en Argentina · 100% en pesos
          </span>
          <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-stone-900 sm:text-4xl md:text-5xl lg:text-6xl">
            Tu centro de estética,{' '}
            <span className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">
              manejado en un solo lugar.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-base text-stone-600 sm:text-lg md:mx-0">
            Agenda, reservas online, recordatorios automáticos por WhatsApp,
            cobros con Mercado Pago, facturación AFIP, ficha clínica y análisis
            de piel con IA. Todo desde una sola app, en castellano.
          </p>

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center md:justify-start">
            <ProbarGratisCTA
              contentName="hero_cta"
              className="group inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-brand-500/20 transition-all hover:bg-brand-600 hover:shadow-xl hover:shadow-brand-500/30"
            >
              Probar 14 días gratis
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </ProbarGratisCTA>
            <Link
              href="/precios"
              className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-stone-300 bg-white/60 px-6 py-3 text-base font-medium text-stone-800 backdrop-blur transition-colors hover:border-stone-400 hover:bg-white"
            >
              Ver precios
            </Link>
          </div>

          <p className="mt-4 text-sm text-stone-500">
            Sin tarjeta. Sin contrato. Pagás cuando te convence.
          </p>
        </FadeUp>

        <FadeUp delay={0.3} distance={56} duration={1.1} immediate className="relative">
          <Float distance={12} duration={4.5}>
            <HeroAgendaMockup />
          </Float>
        </FadeUp>
      </div>
    </section>
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
    <section className="border-t border-stone-100 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <Stagger className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {props.map((p) => (
            <StaggerItem key={p.title}>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700">
                <p.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-stone-900">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{p.text}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// How it works
// ────────────────────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section className="relative overflow-hidden bg-stone-50 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <FadeUp className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
            Empezás en minutos
          </h2>
          <p className="mt-3 text-base text-stone-600">
            Sin instalaciones complicadas ni capacitaciones largas. Te registrás
            y arrancás el mismo día.
          </p>
        </FadeUp>

        <Stagger className="mt-12 grid gap-8 md:grid-cols-3">
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
        </Stagger>
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
    <StaggerItem>
      <HoverLift className="h-full">
        <div className="h-full rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100 transition-shadow hover:shadow-md sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-sm font-bold text-white shadow-sm">
              {n}
            </span>
            <Icon className="h-5 w-5 text-stone-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-stone-900">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">{text}</p>
        </div>
      </HoverLift>
    </StaggerItem>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Features grid
// ────────────────────────────────────────────────────────────────────────────

function FeaturesGrid() {
  const features = [
    { icon: Calendar, title: 'Agenda visual', text: 'Vista día, semana y mes. Arrastrá para reagendar. Códigos de color por estado y profesional.' },
    { icon: Globe, title: 'Reservas online', text: 'Tu link público (estetikkapp.com/c/tu-clinica) o widget embebido en tu web.' },
    { icon: MessageCircle, title: 'WhatsApp recordatorios', text: 'Conectás tu WhatsApp con QR. La PC del consultorio manda los avisos automáticos.' },
    { icon: Receipt, title: 'Facturación AFIP', text: 'Factura C, B, A automática al finalizar el turno. Vinculado a TusFacturas.' },
    { icon: CreditCard, title: 'Mercado Pago', text: 'Pedí seña al reservar. Cobrá en el momento con link. Conciliación automática.' },
    { icon: FileText, title: 'Ficha clínica', text: 'Historia, contraindicaciones, alergias, consentimientos firmados digitalmente.' },
    { icon: Camera, title: 'Fotos antes/después', text: 'Tracking visual del progreso de cada tratamiento. Guardadas privadas.' },
    { icon: Package, title: 'Paquetes prepagos', text: 'Vendé bonos de sesiones con descuento. Tracking de sesiones usadas/restantes.' },
    { icon: Users, title: 'Multi-empleada', text: 'Equipo con permisos por rol. Comisiones automáticas. Dashboard por empleada.' },
    { icon: Sparkles, title: 'IA Claude Vision', text: 'Subís foto de la piel y la IA te sugiere protocolo de tratamiento personalizado.' },
    { icon: ShieldCheck, title: 'Cancelaciones seguras', text: 'Las clientas cancelan con un link único y código. Ventana configurable de 24h.' },
    { icon: Smartphone, title: 'Andá del celu o PC', text: 'Funciona en cualquier dispositivo. App web responsive, sin instalar nada.' },
  ];

  return (
    <section className="py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <FadeUp className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
            Todo lo que necesitás, sin complicarte
          </h2>
          <p className="mt-3 text-base text-stone-600">
            Reemplazá Excel, agendas de papel, WhatsApp Business y mil planillas
            por una sola herramienta.
          </p>
        </FadeUp>

        <Stagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <StaggerItem key={f.title}>
              <HoverLift className="h-full">
                <div className="h-full rounded-2xl border border-stone-100 bg-white p-5 transition-all hover:border-brand-200 hover:shadow-md sm:p-6">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-stone-900">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600">{f.text}</p>
                </div>
              </HoverLift>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Trust
// ────────────────────────────────────────────────────────────────────────────

function Trust() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 to-brand-600 py-14 text-white sm:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-amber-300/10 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-4">
        <Stagger className="grid gap-8 text-center md:grid-cols-3">
          <StaggerItem>
            <p className="text-4xl font-bold tracking-tight sm:text-5xl">
              <CountUp to={100} suffix="%" />
            </p>
            <p className="mt-3 text-sm text-brand-100">
              Hecho en Argentina, pensado para nuestra realidad (AFIP, MP, pesos).
            </p>
          </StaggerItem>
          <StaggerItem>
            <p className="text-4xl font-bold tracking-tight sm:text-5xl">
              <CountUp to={14} suffix=" días" />
            </p>
            <p className="mt-3 text-sm text-brand-100">
              De prueba gratis. Sin tarjeta. Sin compromisos.
            </p>
          </StaggerItem>
          <StaggerItem>
            <p className="text-4xl font-bold tracking-tight sm:text-5xl">WhatsApp</p>
            <p className="mt-3 text-sm text-brand-100">
              Soporte por WhatsApp en horario AR. Hablás con personas, no con bots.
            </p>
          </StaggerItem>
        </Stagger>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Pricing teaser
// ────────────────────────────────────────────────────────────────────────────

function PricingTeaser() {
  return (
    <section className="py-14 sm:py-20">
      <FadeUp className="mx-auto max-w-4xl px-4 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
          Precios simples y claros
        </h2>
        <p className="mt-3 text-base text-stone-600">
          Desde <strong>$29.990/mes</strong> para profesionales que atienden solas.{' '}
          Hasta <strong>$54.990/mes</strong> para equipos completos. Sin sorpresas.
        </p>
        <Link
          href="/precios"
          className="group mt-6 inline-flex items-center gap-2 rounded-lg border-2 border-stone-300 px-6 py-3 font-medium text-stone-800 transition-all hover:border-stone-400 hover:bg-stone-50"
        >
          Ver todos los planes
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </FadeUp>
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
      a: 'No. El registro y los 14 días gratis no piden tarjeta. Al cumplirse el período, vas a poder seguir viendo lo que cargaste pero sin sumar más, hasta que decidas activar un plan.',
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
      a: 'Tenemos un plan empresarial para multi-sucursal con account manager dedicado. Escribinos a estetikkapp@gmail.com y armamos un plan a medida.',
    },
  ];

  return (
    <section className="border-t border-stone-100 bg-stone-50 py-14 sm:py-20">
      <div className="mx-auto max-w-3xl px-4">
        <FadeUp>
          <h2 className="text-center text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
            Preguntas frecuentes
          </h2>
        </FadeUp>

        <Stagger className="mt-10 space-y-3">
          {items.map((it) => (
            <StaggerItem key={it.q}>
              <FaqItem q={it.q} a={it.a} />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-stone-200 bg-white transition-shadow hover:shadow-sm">
      <summary className="flex cursor-pointer items-center justify-between p-5 text-sm font-medium text-stone-900 [&::-webkit-details-marker]:hidden">
        {q}
        <ChevronDown className="h-4 w-4 text-stone-400 transition-transform group-open:rotate-180" />
      </summary>
      <p className="border-t border-stone-100 p-5 text-sm leading-relaxed text-stone-600">{a}</p>
    </details>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Final CTA
// ────────────────────────────────────────────────────────────────────────────

function FinalCta() {
  return (
    <section className="relative overflow-hidden py-14 sm:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-50/60 via-white to-amber-50/30"
      />
      <FadeUp className="relative mx-auto max-w-3xl px-4 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
          Probalo 14 días gratis y decidí
        </h2>
        <p className="mt-4 text-base text-stone-600">
          Sin tarjeta. Sin contrato. Si te gusta, pagás. Si no, te vas.
        </p>
        <ProbarGratisCTA
          contentName="final_cta"
          className="group mt-8 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-8 py-4 text-lg font-semibold text-white shadow-xl shadow-brand-500/30 transition-all hover:shadow-2xl hover:shadow-brand-500/40"
        >
          Empezar ahora
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </ProbarGratisCTA>
        <p className="mt-4 text-sm text-stone-500">
          ¿Dudas?{' '}
          <a href="mailto:estetikkapp@gmail.com" className="text-brand-600 underline">
            Escribinos
          </a>{' '}
          o entrá a{' '}
          <Link href="/ayuda" className="text-brand-600 underline">
            la sección de ayuda
          </Link>
          .
        </p>
      </FadeUp>
    </section>
  );
}

