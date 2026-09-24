import { SECTION_DURATION_MS } from '@/data/examSpec';
import { formatClock } from '@/lib/scoring';
import { cx } from '@/components/ui';

/**
 * The section countdown.
 *
 * Turns amber under five minutes and red under one minute, and announces those
 * thresholds politely to screen readers rather than reading out every second.
 */

export const WARNING_MS = 5 * 60 * 1000;
export const DANGER_MS = 60 * 1000;

export type TimerTone = 'normal' | 'warning' | 'danger';

export const timerTone = (remainingMs: number): TimerTone => {
  if (remainingMs <= DANGER_MS) return 'danger';
  if (remainingMs <= WARNING_MS) return 'warning';
  return 'normal';
};

const TONE_CLASSES: Record<TimerTone, string> = {
  normal: 'border-ink-200 bg-white text-ink-900',
  warning: 'border-amber-300 bg-amber-50 text-amber-800',
  danger: 'border-red-300 bg-red-50 text-red-700 animate-pulse',
};

export function Timer({
  remainingMs,
  durationMs = SECTION_DURATION_MS,
  label = 'Time remaining',
  className,
}: {
  remainingMs: number;
  durationMs?: number;
  label?: string;
  className?: string;
}) {
  const tone = timerTone(remainingMs);
  const elapsedRatio = durationMs <= 0 ? 0 : 1 - Math.min(1, Math.max(0, remainingMs / durationMs));
  const minutesLeft = Math.ceil(remainingMs / 60000);

  return (
    <div
      className={cx(
        'min-w-[9.5rem] rounded-lg border px-4 py-2 text-right',
        TONE_CLASSES[tone],
        className,
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
      <p className="font-mono text-2xl font-bold tabular-nums leading-tight" aria-hidden="true">
        {formatClock(remainingMs)}
      </p>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-black/10">
        <div
          className={cx(
            'h-full rounded-full transition-[width] duration-200',
            tone === 'danger' ? 'bg-red-500' : tone === 'warning' ? 'bg-amber-500' : 'bg-brand-600',
          )}
          style={{ width: `${elapsedRatio * 100}%` }}
        />
      </div>
      {/* Screen readers get a coarse update instead of a per-second stream. */}
      <span className="sr-only" role="status" aria-live="polite">
        {remainingMs === 0
          ? 'Time is up.'
          : `About ${minutesLeft} ${minutesLeft === 1 ? 'minute' : 'minutes'} remaining.`}
      </span>
    </div>
  );
}
