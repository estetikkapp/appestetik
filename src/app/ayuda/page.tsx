import Link from 'next/link';
import type { ComponentType } from 'react';
import {
  Calendar,
  Users,
  Scissors,
  Globe,
  MessageCircle,
  CreditCard,
  Receipt,
  FileText,
  Sparkles,
  UserCog,
  Clock,
  Package,
  Settings,
  BarChart3,
  Smartphone,
  ChevronRight,
  Mail,
} from 'lucide-react';

export const metadata = {
  title: 'Guía de uso — appestetika',
  description: 'Cómo usar cada función de appestetika: agenda, reservas, WhatsApp, cobros, IA y más.',
};

interface GuideSection {
  id: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  intro: string;
  /** Pasos en orden. Cada paso es plain text, podemos enriquecer después. */
  steps: string[];
  /** Tip opcional al final. */
  tip?: string;
  /** Link al panel donde se usa (si aplica). */
  panelLink?: { href: string; label: string };
}

const SECTIONS: GuideSection[] = [
  {
    id: 'empezar',
    icon: Smartphone,
    title: 'Para empezar',
    intro: 'Lo primero que hacés después de crear tu cuenta.',
    steps: [
      'Te registrás con tu email en /auth/signup. Te llega un mail de bienvenida.',
      'Elegís tu plan (Gabinete si atendés sola, Equipo si tenés empleadas). El primer mes es gratis sin tarjeta.',
      'Completás los datos fiscales de tu centro: nombre, CUIT, condición IVA.',
      'Cargás tu plantilla de horarios (qué días/horas trabajás).',
      'Cargás tu primer servicio (nombre, duración, precio).',
      'Definís el slug público de tu centro (ej. "centro-belleza-norte"). Tu link de reservas va a ser estetikkapp.com/c/centro-belleza-norte.',
    ],
    tip: 'Podés saltarte pasos y volver más tarde — el onboarding te avisa qué te falta para que las clientas puedan reservar.',
  },
  {
    id: 'agenda',
    icon: Calendar,
    title: 'Tu agenda',
    intro: 'El corazón de la app. Vista día, semana y mes con todos tus turnos.',
    steps: [
      'Andá a /agenda. Por default ves el día de hoy con los turnos en barras horarias.',
      'Cambiás entre vista Día / Semana / Mes con los botones de arriba.',
      'Cliqueás en cualquier hora libre para crear un turno nuevo.',
      'Cliqueás en un turno existente para verlo en detalle, reagendar, marcar como completo, cancelar.',
      'El botón "+ Nuevo turno" arriba a la derecha abre el formulario completo.',
      'Cada turno muestra: clienta, servicio, hora, profesional asignada, estado (pendiente/confirmado/completo/cancelado).',
    ],
    tip: 'Pasá el mouse por un turno para ver acciones rápidas. La granularidad de slots la configurás en /horarios (recomendamos 15 minutos).',
    panelLink: { href: '/agenda', label: 'Ir a la agenda' },
  },
  {
    id: 'clientas',
    icon: Users,
    title: 'Tus clientas',
    intro: 'Base de datos de pacientes con ficha clínica completa.',
    steps: [
      'En /clientas ves la lista completa. Buscá por nombre, DNI o teléfono.',
      'Click en una clienta para ver su ficha: datos personales, historial de turnos, fotos antes/después, paquetes activos.',
      'Botón "+ Nueva clienta" para agregar una manual. Las que reservan online se crean solas.',
      'En la ficha clínica cargás: alergias, contraindicaciones, tipo de piel, fototipo.',
      'Subís fotos del progreso de cada tratamiento (guardadas privadas en tu cuenta).',
      'Los consentimientos los firma la clienta en tablet/celu directamente.',
    ],
    tip: 'Si una clienta reserva online sin estar cargada, la app la crea automáticamente con los datos del formulario. Después le completás la ficha.',
    panelLink: { href: '/clientas', label: 'Ir a clientas' },
  },
  {
    id: 'servicios',
    icon: Scissors,
    title: 'Tus servicios',
    intro: 'Catálogo de tratamientos con precio, duración y buffer entre turnos.',
    steps: [
      'En /servicios cargás cada servicio: nombre, duración en minutos, precio en pesos.',
      'Buffer (opcional): tiempo adicional entre turno y turno para limpieza/preparación.',
      'Categoría (opcional): para agruparlos en /c/[slug] cuando la clienta reserva.',
      'Marcás servicios como "Activos" o "Archivados". Solo los activos aparecen en reservas online.',
      'Si tenés plan Equipo, asignás qué empleadas pueden hacer cada servicio.',
    ],
    tip: 'Si un servicio tiene preparación variable, mejor poné la duración promedio y armás un buffer estándar de 5-10 min.',
    panelLink: { href: '/servicios', label: 'Ir a servicios' },
  },
  {
    id: 'horarios',
    icon: Clock,
    title: 'Plantillas de horarios',
    intro: 'Definís cuándo está abierto tu centro y cuándo trabaja cada empleada.',
    steps: [
      'En /horarios creás "plantillas de horario" (ej. Turno mañana, Turno tarde, Turno completo).',
      'Cada plantilla tiene una rejilla semanal: ¿qué días trabajás? ¿de qué hora a qué hora?',
      'Configurás slot_minutes (granularidad): cada cuántos minutos se ofrecen turnos. Recomendamos 15 min para que servicios de cualquier duración (30, 45, 60, 90) tilen perfectamente.',
      'Asignás una plantilla a cada empleada en /empleadas.',
      'En /cierres marcás vacaciones, feriados o cierres puntuales.',
    ],
    tip: 'Granularidad 15 minutos no significa que tus servicios duren 15 min — ofrece slots cada 15min, pero el sistema bloquea automáticamente los slots que se solapen.',
    panelLink: { href: '/horarios', label: 'Ir a horarios' },
  },
  {
    id: 'reservas-online',
    icon: Globe,
    title: 'Reservas online (tu link público)',
    intro: 'Tu link estetikkapp.com/c/tu-slug donde las clientas reservan solas.',
    steps: [
      'El link público lo configurás en /configuracion → "Reservas online".',
      'En /agenda hay un botón "Compartir link" para copiarlo o compartirlo por WhatsApp.',
      'Lo pegás en tu bio de Instagram, en mensajes de WhatsApp, en tu sitio web.',
      'La clienta entra, elige servicio, elige profesional (o "cualquiera"), elige fecha y hora.',
      'Completa sus datos (nombre, DNI, teléfono, email) y confirma.',
      'Recibe email de confirmación con código de cancelación.',
      'Vos ves el turno nuevo en tu agenda en tiempo real.',
    ],
    tip: 'Si tu sitio web es WordPress / Wix / etc., podés embeber el formulario de reservas como iframe (código en /configuracion).',
    panelLink: { href: '/configuracion', label: 'Configurar mi link' },
  },
  {
    id: 'whatsapp',
    icon: MessageCircle,
    title: 'WhatsApp y recordatorios',
    intro: 'Cómo conectar tu WhatsApp para que mande recordatorios automáticos.',
    steps: [
      'Bajás el "Agente local" desde /agente — un pequeño programa para tu PC (Windows/Mac/Linux).',
      'Lo instalás (siguiente, siguiente, instalar). Aparece en la barra de tareas/bandeja.',
      'En /configuracion → sección "Agente local" generás un código (abp_xxx).',
      'Pegás el código en el agente cuando te lo pida.',
      'El agente muestra un QR de WhatsApp. Lo escaneás con tu celu (WhatsApp → Dispositivos vinculados → Vincular).',
      'Listo: cada día a las 9 AM el sistema le manda WhatsApp a los turnos que tienen 24-48hs (recordatorio automático).',
    ],
    tip: 'La PC con el agente tiene que estar prendida cuando se mandan los recordatorios (típicamente 1 vez al día a la mañana). Si está apagada, los mensajes se encolan y salen cuando se prenda.',
    panelLink: { href: '/agente', label: 'Descargar agente' },
  },
  {
    id: 'cobros',
    icon: CreditCard,
    title: 'Cobros con Mercado Pago',
    intro: 'Conectás tu cuenta de MP para cobrar señas online y registrar pagos.',
    steps: [
      'En /configuracion → "Mercado Pago" pegás tu Access Token (lo sacás de mercadopago.com.ar → Tu app → Credenciales).',
      'Una vez conectado, podés pedirle señas a tus clientas al reservar.',
      'En /cobros ves todos los pagos: pendientes, aprobados, rechazados.',
      'Generás links de cobro manuales para cobros en el momento (ej. clienta sin reserva previa).',
      'Cada cobro se asocia automáticamente con su turno y/o paquete.',
    ],
    tip: 'Si todavía no tenés MP, podés usar la app sin conectarlo. Cobrás efectivo/transferencia/POS y los registrás manualmente.',
    panelLink: { href: '/cobros', label: 'Ir a cobros' },
  },
  {
    id: 'facturas',
    icon: Receipt,
    title: 'Facturación AFIP',
    intro: 'Emisión automática de facturas C, B y A con CAE.',
    steps: [
      'Cada centro carga sus propias credenciales de TusFacturas (servicio externo ~$5k/mes según plan).',
      'En /configuracion → "AFIP" elegís proveedor "TusFacturas" y pegás API Key, API Token y User Token.',
      'Tu cuenta de TusFacturas se conecta a AFIP via tu clave fiscal (wizard guiado en su sitio).',
      'Una vez listo, cada turno completado emite factura automáticamente con CAE.',
      'Si todavía no querés facturar electrónicamente, dejá el proveedor en "Manual" — emitimos comprobantes internos no fiscales.',
    ],
    tip: 'TusFacturas se ocupa del 99% de la complejidad con AFIP. Lo que ves del lado nuestro es solo "pegá los 3 tokens".',
    panelLink: { href: '/configuracion', label: 'Configurar AFIP' },
  },
  {
    id: 'paquetes',
    icon: Package,
    title: 'Paquetes prepagos',
    intro: 'Vendé bonos de sesiones con descuento (ej. "10 sesiones láser axilas").',
    steps: [
      'En /paquetes (plan Equipo) creás cada paquete: nombre, servicio asociado, cantidad de sesiones, precio total.',
      'Asignás un paquete a una clienta desde su ficha clínica.',
      'Cada vez que se completa una sesión del servicio incluido, el paquete descuenta automáticamente.',
      'La clienta ve cuántas sesiones le quedan en su confirmación de turno.',
    ],
    tip: 'Útil para tratamientos largos donde te conviene cobrar adelantado. Los paquetes vencidos (ej. 12 meses sin completarse) se archivan automáticamente.',
    panelLink: { href: '/paquetes', label: 'Ir a paquetes' },
  },
  {
    id: 'equipo',
    icon: UserCog,
    title: 'Tu equipo (plan Equipo)',
    intro: 'Cómo agregar empleadas y configurar permisos.',
    steps: [
      'En /empleadas invitás por email. La empleada recibe un link, crea su contraseña y queda dentro.',
      'Asignás un rol: Admin (todos los permisos excepto borrar al owner), Profesional (atiende clientas), Recepcionista (front desk).',
      'Asignás una plantilla de horarios (cuándo trabaja cada una).',
      'Asignás qué servicios puede hacer cada profesional (opcional — si no asignás, hace todos).',
      'Configurás comisiones: porcentaje por empleada y por servicio (opcional).',
      'Cada empleada ve solo lo que su rol permite. Profesionales ven su propia agenda y clientas.',
    ],
    tip: 'El plan Gabinete viene con 1 usuaria. Si necesitás más, subís a Equipo (hasta 5 usuarias) desde /precios.',
    panelLink: { href: '/empleadas', label: 'Ir a empleadas' },
  },
  {
    id: 'ia',
    icon: Sparkles,
    title: 'IA: análisis de piel y protocolos',
    intro: 'Subís foto de la piel y la IA sugiere un protocolo de tratamiento.',
    steps: [
      'En /ia hay 2 herramientas: "Análisis de piel" y "Generador de protocolos".',
      'Análisis de piel: subís foto de la clienta (idealmente sin maquillaje, buena luz). La IA detecta: tipo de piel, fototipo Fitzpatrick, scores de hidratación, arrugas, manchas, poros, acné.',
      'Te recomienda servicios de tu catálogo que mejor le calzan a esa piel.',
      'Generador de protocolos: completás objetivo (rejuvenecer, despigmentar, etc.), presupuesto, frecuencia. La IA arma un plan de N sesiones con servicios de tu catálogo.',
      'Cada plan tiene un límite mensual: 20 análisis y 10 protocolos en Gabinete; 100 y 40 en Equipo.',
      'Si te quedás corta, comprás packs extra ($4.990 c/u) o subís de plan.',
    ],
    tip: 'La IA usa Claude Vision (Anthropic). Las fotos no se comparten con terceros, se guardan privadas en tu cuenta.',
    panelLink: { href: '/ia', label: 'Probar IA' },
  },
  {
    id: 'reportes',
    icon: BarChart3,
    title: 'Reportes (plan Equipo)',
    intro: 'Métricas de facturación, no-shows, rentabilidad.',
    steps: [
      'En /reportes elegís rango de fechas (default último mes).',
      'Ves: facturación total, ticket promedio, top servicios, top profesionales, tasa de no-shows.',
      'Exportás a CSV: turnos, pagos, clientas.',
      'Dashboard por empleada: cuántas clientas atendió, cuánto facturó, comisiones acumuladas.',
    ],
    tip: 'Los reportes son del plan Equipo. En Gabinete ves un resumen básico en /agenda.',
    panelLink: { href: '/reportes', label: 'Ir a reportes' },
  },
  {
    id: 'configuracion',
    icon: Settings,
    title: 'Configuración general',
    intro: 'Donde personalizás cosas globales de tu centro.',
    steps: [
      'En /configuracion editás: logo, datos fiscales, CUIT, condición IVA.',
      'Tu link público y código embed.',
      'Conexión MP, AFIP, WhatsApp.',
      'Tu plan actual (Gabinete o Equipo): podés cambiar, cancelar, reactivar.',
      'Email de notificaciones, zona horaria, idioma (todo por default está bien para AR).',
    ],
    panelLink: { href: '/configuracion', label: 'Ir a configuración' },
  },
  {
    id: 'consentimientos',
    icon: FileText,
    title: 'Consentimientos digitales',
    intro: 'Firma digital de consentimientos informados.',
    steps: [
      'Por cada tratamiento que lo requiera, hay un consentimiento que la clienta firma desde el celu.',
      'En la ficha de la clienta marcás "Firmar consentimiento" — le mandás un link único.',
      'La clienta abre el link, lee el texto, dibuja su firma con el dedo en pantalla, confirma.',
      'El consentimiento queda guardado en su ficha con timestamp y la firma renderizada.',
      'Si la clienta retira el consentimiento, lo marcás revocado.',
    ],
    tip: 'Los textos de los consentimientos los podés personalizar por servicio. Te damos plantillas base de los más comunes (depilación, microblading, peelings).',
  },
];

export default function AyudaPage() {
  return (
    <>
      <div className="text-center">
        <h1 className="text-3xl font-bold text-stone-900 sm:text-4xl">
          Guía de uso de appestetika
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-stone-600">
          Todo lo que necesitás saber para sacarle el jugo a la app. Empezá por
          el principio o saltá directo a la sección que te interesa.
        </p>
      </div>

      <nav className="mt-10 rounded-2xl border border-stone-200 bg-white p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
          En esta guía
        </p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-stone-700 hover:bg-stone-50 hover:text-brand-700"
              >
                <s.icon className="h-4 w-4 text-stone-400" />
                <span className="flex-1">{s.title}</span>
                <ChevronRight className="h-4 w-4 text-stone-300" />
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-10 space-y-6">
        {SECTIONS.map((s) => (
          <Section key={s.id} {...s} />
        ))}
      </div>

      <div className="mt-16 rounded-2xl border border-brand-200 bg-brand-50 p-8 text-center">
        <Mail className="mx-auto h-8 w-8 text-brand-600" />
        <h2 className="mt-3 text-xl font-bold text-stone-900">
          ¿Algo que no encontraste?
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-stone-600">
          Escribinos a{' '}
          <a
            href="mailto:hola@estetikkapp.com"
            className="font-medium text-brand-700 underline"
          >
            hola@estetikkapp.com
          </a>{' '}
          o por WhatsApp y te ayudamos. El equipo está en Argentina y responde
          en horario laboral.
        </p>
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/auth/signup"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white hover:bg-brand-600"
        >
          Empezar a usarlo
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}

function Section({
  id,
  icon: Icon,
  title,
  intro,
  steps,
  tip,
  panelLink,
}: GuideSection) {
  return (
    <article
      id={id}
      className="scroll-mt-20 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8"
    >
      <div className="flex items-start gap-4">
        <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-stone-900">{title}</h2>
          <p className="mt-1 text-sm text-stone-600">{intro}</p>
        </div>
      </div>

      <ol className="mt-6 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-sm text-stone-700">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
              {i + 1}
            </span>
            <p className="leading-relaxed">{step}</p>
          </li>
        ))}
      </ol>

      {tip && (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Tip:</strong> {tip}
        </div>
      )}

      {panelLink && (
        <div className="mt-5 border-t border-stone-100 pt-4">
          <Link
            href={panelLink.href}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
          >
            {panelLink.label}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </article>
  );
}
