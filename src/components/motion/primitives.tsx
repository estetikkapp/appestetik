'use client';

/**
 * Motion primitives reutilizables. Todos respetan `prefers-reduced-motion`:
 * usuarios con la preferencia activa ven el contenido sin animar.
 *
 * Filosofía: animaciones SUTILES, no flashy. Subtle is professional.
 */

import {
  motion,
  useReducedMotion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
  type Variants,
  type Transition,
} from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';

// ────────────────────────────────────────────────────────────────────────────
// FadeUp — fade-in + translate-up al entrar en viewport
// ────────────────────────────────────────────────────────────────────────────

interface FadeUpProps {
  children: ReactNode;
  className?: string;
  /** Delay en segundos (para encadenar con otros FadeUp). */
  delay?: number;
  /** Cuánto se mueve hacia arriba. Default 16px. */
  distance?: number;
  /** Duración en segundos. Default 0.6. */
  duration?: number;
  /** Cuándo dispara: `0.2` = cuando 20% del elemento está en viewport. */
  amount?: number;
  /** Si true, anima solo la primera vez. Default true. */
  once?: boolean;
  /** Tag HTML del wrapper. Default 'div'. */
  as?: 'div' | 'section' | 'article' | 'span' | 'li';
}

export function FadeUp({
  children,
  className,
  delay = 0,
  distance = 40,
  duration = 0.9,
  amount = 0.15,
  once = true,
  as = 'div',
  /** Si true, anima en mount (útil para hero que ya está en viewport). */
  immediate = false,
}: FadeUpProps & { immediate?: boolean }) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] as typeof motion.div;

  if (reduce) {
    const Tag = as as 'div';
    return <Tag className={className}>{children}</Tag>;
  }

  const viewportProps = immediate
    ? { initial: { opacity: 0, y: distance }, animate: { opacity: 1, y: 0 } }
    : {
        initial: { opacity: 0, y: distance },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once, amount },
      };

  return (
    <MotionTag
      className={className}
      {...viewportProps}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Stagger — anima hijos en cascada
// ────────────────────────────────────────────────────────────────────────────

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.15 },
  },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 32, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] satisfies Transition['ease'] },
  },
};

export function Stagger({
  children,
  className,
  amount = 0.15,
  once = true,
}: {
  children: ReactNode;
  className?: string;
  amount?: number;
  once?: boolean;
}) {
  const reduce = useReducedMotion();

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount }}
    >
      {children}
    </motion.div>
  );
}

/** Cada hijo de un <Stagger> debe ir wrappeado en <StaggerItem>. */
export function StaggerItem({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'li' | 'article';
}) {
  const MotionTag = motion[as] as typeof motion.div;
  return (
    <MotionTag variants={staggerItem} className={className}>
      {children}
    </MotionTag>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Float — flotación suave (para mockups, badges)
// ────────────────────────────────────────────────────────────────────────────

export function Float({
  children,
  className,
  /** Píxeles de oscilación. Default 12. */
  distance = 12,
  /** Segundos por ciclo completo. Default 4.5. */
  duration = 4.5,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      animate={{ y: [0, -distance, 0] }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// CountUp — conteo numérico al entrar en viewport
// ────────────────────────────────────────────────────────────────────────────

export function CountUp({
  to,
  from = 0,
  duration = 1.5,
  className,
  /** Sufijo opcional (ej. '%', '+', 'k'). */
  suffix = '',
  /** Prefijo opcional (ej. '$'). */
  prefix = '',
}: {
  to: number;
  from?: number;
  duration?: number;
  className?: string;
  suffix?: string;
  prefix?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const mv = useMotionValue(from);
  const rounded = useTransform(mv, (v) => `${prefix}${Math.round(v).toLocaleString('es-AR')}${suffix}`);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      mv.set(to);
      return;
    }
    const controls = animate(mv, to, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [inView, reduce, mv, to, duration]);

  return (
    <motion.span ref={ref} className={className}>
      {rounded}
    </motion.span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// HoverLift — micro-interaction de elevación en hover (para cards)
// ────────────────────────────────────────────────────────────────────────────

export function HoverLift({
  children,
  className,
  /** Píxeles que sube. Default 4. */
  distance = 4,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      whileHover={{ y: -distance }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
