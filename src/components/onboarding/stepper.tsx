import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const STEPS = [
  { n: 1, label: 'Tu plan', path: '/onboarding/plan' },
  { n: 2, label: 'Importar', path: '/onboarding/importar' },
  { n: 3, label: 'Datos fiscales', path: '/onboarding' },
  { n: 4, label: 'Horarios', path: '/onboarding/horarios' },
  { n: 5, label: 'Primer servicio', path: '/onboarding/servicio' },
  { n: 6, label: 'Presencia', path: '/onboarding/presencia' },
];

export function OnboardingStepper({ current }: { current: number }) {
  return (
    <nav aria-label="Progreso del onboarding" className="mb-8">
      <ol className="flex items-center justify-between gap-2">
        {STEPS.map((step) => {
          const done = step.n < current;
          const active = step.n === current;
          return (
            <li key={step.n} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                    done && 'border-brand-500 bg-brand-500 text-white',
                    active && 'border-brand-500 bg-white text-brand-700',
                    !done && !active && 'border-stone-200 bg-white text-stone-400'
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : step.n}
                </div>
                <span
                  className={cn(
                    'hidden text-xs font-medium sm:block',
                    (done || active) && 'text-brand-700',
                    !done && !active && 'text-stone-400'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {step.n < STEPS.length && (
                <div
                  className={cn(
                    'mx-2 h-[2px] flex-1 -translate-y-3 rounded',
                    done ? 'bg-brand-500' : 'bg-stone-200'
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
