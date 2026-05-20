'use client';

/**
 * Mockup visual del hero — una mini-agenda con turnos del día + banner de
 * WhatsApp confirmado. Client component porque tiene micro-animaciones de
 * stagger en los appointment rows y pulse en el badge de notificación.
 */

import { CheckCircle2, Clock, MessageCircle } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

const APPOINTMENTS = [
  { time: '09:30', client: 'María Fernández', service: 'Limpieza profunda', duration: '60 min', status: 'confirmed' as const },
  { time: '11:00', client: 'Lucía Pérez', service: 'Botox frente', duration: '30 min', status: 'confirmed' as const },
  { time: '12:00', client: 'Sofía Ruiz', service: 'Masaje relajante', duration: '90 min', status: 'pending' as const },
  { time: '15:00', client: 'Carla Méndez', service: 'Diseño de cejas', duration: '45 min', status: 'confirmed' as const },
];

export function HeroAgendaMockup() {
  const reduce = useReducedMotion();

  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl shadow-stone-200/60 sm:max-w-md md:max-w-none md:p-6">
      {/* Mac-style window header */}
      <div className="flex items-center gap-2 border-b border-stone-100 pb-4">
        <div className="h-3 w-3 rounded-full bg-red-400" />
        <div className="h-3 w-3 rounded-full bg-amber-400" />
        <div className="h-3 w-3 rounded-full bg-emerald-400" />
        <span className="ml-2 text-xs text-stone-500">tu agenda hoy</span>
      </div>

      <motion.div
        className="mt-4 space-y-2.5"
        initial={reduce ? false : 'hidden'}
        whileInView={reduce ? undefined : 'show'}
        viewport={{ once: true, amount: 0.3 }}
        variants={{
          hidden: { opacity: 1 },
          show: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.4 } },
        }}
      >
        {APPOINTMENTS.map((a) => (
          <motion.div
            key={a.time}
            variants={{
              hidden: { opacity: 0, x: -16 },
              show: { opacity: 1, x: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
            }}
            className="flex items-center gap-3 rounded-lg border border-stone-100 bg-white p-3 transition-shadow hover:shadow-sm"
          >
            <div className="w-12 shrink-0 text-sm font-semibold text-stone-900">{a.time}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-stone-900">{a.client}</p>
              <p className="truncate text-xs text-stone-500">
                {a.service} · {a.duration}
              </p>
            </div>
            {a.status === 'confirmed' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <Clock className="h-4 w-4 text-amber-500" />
            )}
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5, delay: 1.0, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs font-medium text-emerald-800"
      >
        <motion.span
          aria-hidden
          className="relative inline-flex h-2 w-2"
          initial={false}
          animate={reduce ? undefined : { scale: [1, 1.2, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="absolute inset-0 rounded-full bg-emerald-500" />
        </motion.span>
        <MessageCircle className="h-3.5 w-3.5" />
        Recordatorio enviado por WhatsApp a 4 clientas
      </motion.div>
    </div>
  );
}
