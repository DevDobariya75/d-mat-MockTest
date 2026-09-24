import { useEffect, useRef, useState } from 'react';

/**
 * A countdown driven by an absolute deadline rather than by a decrementing
 * counter. Because `endsAt` is an epoch timestamp persisted in localStorage,
 * reloading the page, switching tabs or letting the machine sleep can never
 * hand the test taker extra time.
 *
 * `onExpire` fires exactly once per deadline.
 */
export interface CountdownState {
  remainingMs: number;
  expired: boolean;
}

export function useCountdown(
  endsAt: number | null,
  options: { active: boolean; onExpire?: () => void; tickMs?: number } = { active: false },
): CountdownState {
  const { active, onExpire, tickMs = 250 } = options;

  const compute = (): number => {
    if (!active || endsAt === null) return 0;
    return Math.max(0, endsAt - Date.now());
  };

  const [remaining, setRemaining] = useState<number>(compute);
  const firedFor = useRef<number | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!active || endsAt === null) {
      setRemaining(0);
      return;
    }

    const tick = () => {
      const next = Math.max(0, endsAt - Date.now());
      setRemaining(next);
      if (next === 0 && firedFor.current !== endsAt) {
        firedFor.current = endsAt;
        onExpireRef.current?.();
      }
    };

    tick();
    const id = window.setInterval(tick, tickMs);

    // A tab that was in the background may have throttled the interval, so
    // re-check as soon as it becomes visible again.
    const onVisibility = () => tick();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active, endsAt, tickMs]);

  useEffect(() => {
    firedFor.current = null;
  }, [endsAt]);

  return { remainingMs: remaining, expired: active && endsAt !== null && remaining === 0 };
}
