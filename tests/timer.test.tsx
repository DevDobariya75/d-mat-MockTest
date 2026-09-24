import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DANGER_MS, WARNING_MS, timerTone } from '@/components/Timer';
import { SECTION_DURATION_MS } from '@/data/examSpec';
import { useCountdown } from '@/hooks/useCountdown';
import { formatClock, formatDuration } from '@/lib/scoring';
import { hasExpired, remainingMs } from '@/lib/sessionRules';
import { emptySectionAttempt } from '@/lib/storage';
import type { SectionAttempt } from '@/types';

const START = 1_700_000_000_000;

const runningSection = (overrides: Partial<SectionAttempt> = {}): SectionAttempt => ({
  ...emptySectionAttempt(),
  status: 'in-progress',
  startedAt: START,
  endsAt: START + SECTION_DURATION_MS,
  ...overrides,
});

describe('countdown clock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at the full section duration', () => {
    const { result } = renderHook(() =>
      useCountdown(START + SECTION_DURATION_MS, { active: true }),
    );
    expect(result.current.remainingMs).toBe(SECTION_DURATION_MS);
    expect(result.current.expired).toBe(false);
  });

  it('counts down as time passes', () => {
    const { result } = renderHook(() =>
      useCountdown(START + SECTION_DURATION_MS, { active: true }),
    );

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.remainingMs).toBe(SECTION_DURATION_MS - 60_000);
  });

  it('never goes below zero and reports expiry', () => {
    const { result } = renderHook(() =>
      useCountdown(START + SECTION_DURATION_MS, { active: true }),
    );

    act(() => {
      vi.advanceTimersByTime(SECTION_DURATION_MS + 10_000);
    });

    expect(result.current.remainingMs).toBe(0);
    expect(result.current.expired).toBe(true);
  });

  it('fires onExpire exactly once', () => {
    const onExpire = vi.fn();
    renderHook(() => useCountdown(START + 5_000, { active: true, onExpire }));

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('does not run while the section is inactive', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() =>
      useCountdown(START - 1_000, { active: false, onExpire }),
    );

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.remainingMs).toBe(0);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('derives the remaining time from the stored deadline, so a refresh grants no extra time', () => {
    // First mount: three minutes pass, then the "page is reloaded".
    const endsAt = START + SECTION_DURATION_MS;
    const first = renderHook(() => useCountdown(endsAt, { active: true }));
    act(() => {
      vi.advanceTimersByTime(3 * 60_000);
    });
    const beforeReload = first.result.current.remainingMs;
    first.unmount();

    // Two more minutes pass with the app closed.
    act(() => {
      vi.advanceTimersByTime(2 * 60_000);
    });

    const second = renderHook(() => useCountdown(endsAt, { active: true }));
    expect(beforeReload).toBe(SECTION_DURATION_MS - 3 * 60_000);
    expect(second.result.current.remainingMs).toBe(SECTION_DURATION_MS - 5 * 60_000);
  });

  it('reports a deadline that passed while the app was closed as expired', () => {
    const section = runningSection({ endsAt: START - 1 });
    expect(remainingMs(section, START)).toBe(0);
    expect(hasExpired(section, START)).toBe(true);
  });

  it('treats a section that is not running as having no clock', () => {
    const notStarted = emptySectionAttempt();
    expect(remainingMs(notStarted, START)).toBe(0);
    expect(hasExpired(notStarted, START)).toBe(false);

    const submitted: SectionAttempt = { ...runningSection(), status: 'submitted' };
    expect(remainingMs(submitted, START)).toBe(0);
    expect(hasExpired(submitted, START)).toBe(false);
  });
});

describe('clock formatting and tone', () => {
  it('formats the remaining time as mm:ss, rounding up to the displayed second', () => {
    expect(formatClock(SECTION_DURATION_MS)).toBe('25:00');
    expect(formatClock(61_000)).toBe('01:01');
    expect(formatClock(999)).toBe('00:01');
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(-5_000)).toBe('00:00');
  });

  it('formats elapsed durations without padding the minutes', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(75 * 60_000)).toBe('75:00');
    expect(formatDuration(90_500)).toBe('1:31');
  });

  it('escalates the tone under five minutes and under one minute', () => {
    expect(timerTone(SECTION_DURATION_MS)).toBe('normal');
    expect(timerTone(WARNING_MS + 1)).toBe('normal');
    expect(timerTone(WARNING_MS)).toBe('warning');
    expect(timerTone(DANGER_MS + 1)).toBe('warning');
    expect(timerTone(DANGER_MS)).toBe('danger');
    expect(timerTone(0)).toBe('danger');
  });
});
