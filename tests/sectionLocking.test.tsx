import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SECTION_DURATION_MS } from '@/data/examSpec';
import { getTest } from '@/data/questionBank';
import { useTestSession } from '@/hooks/useTestSession';
import {
  canStartSection,
  isTestComplete,
  nextSectionId,
  orderedSectionIds,
  runningSectionId,
  sectionAvailability,
  submittedSectionCount,
} from '@/lib/sessionRules';
import { emptyAttempt, loadAttempt } from '@/lib/storage';
import type { LatinSquaresQuestion, SectionId, TestAttempt } from '@/types';

const START = 1_700_000_000_000;
const ORDER: SectionId[] = ['figure-sequences', 'mathematical-equations', 'latin-squares'];

const withStatuses = (
  statuses: Partial<Record<SectionId, 'not-started' | 'in-progress' | 'submitted'>>,
): TestAttempt => {
  const attempt = emptyAttempt(1, START);
  for (const [id, status] of Object.entries(statuses)) {
    const section = attempt.sections[id]!;
    section.status = status!;
    if (status === 'in-progress') {
      section.startedAt = START;
      section.endsAt = START + SECTION_DURATION_MS;
    }
    if (status === 'submitted') {
      section.submittedAt = START;
      section.timeUsedMs = 60_000;
    }
  }
  return attempt;
};

describe('section order', () => {
  it('exposes the sections in exam order', () => {
    expect(orderedSectionIds()).toEqual(ORDER);
  });

  it('only allows the first section at the start of a test', () => {
    const attempt = emptyAttempt(1, START);
    expect(sectionAvailability(attempt, 'figure-sequences').state).toBe('available');
    expect(sectionAvailability(attempt, 'mathematical-equations').state).toBe('locked');
    expect(sectionAvailability(attempt, 'latin-squares').state).toBe('locked');
  });

  it('explains why a later section is locked', () => {
    const availability = sectionAvailability(emptyAttempt(1, START), 'latin-squares');
    expect(availability.state).toBe('locked');
    if (availability.state === 'locked') {
      expect(availability.reason).toContain('Complete section 1');
    }
  });

  it('unlocks the next section only once the previous one is submitted', () => {
    const attempt = withStatuses({ 'figure-sequences': 'submitted' });
    expect(sectionAvailability(attempt, 'mathematical-equations').state).toBe('available');
    expect(sectionAvailability(attempt, 'latin-squares').state).toBe('locked');
  });

  it('keeps a running section from being escaped into another one', () => {
    const attempt = withStatuses({
      'figure-sequences': 'submitted',
      'mathematical-equations': 'in-progress',
    });

    expect(sectionAvailability(attempt, 'mathematical-equations').state).toBe('in-progress');
    const latin = sectionAvailability(attempt, 'latin-squares');
    expect(latin.state).toBe('locked');
    if (latin.state === 'locked') {
      expect(latin.reason).toContain('currently taking');
    }
    expect(canStartSection(attempt, 'latin-squares')).toBe(false);
  });

  it('reports a submitted section as submitted, never as available again', () => {
    const attempt = withStatuses({ 'figure-sequences': 'submitted' });
    expect(sectionAvailability(attempt, 'figure-sequences').state).toBe('submitted');
    expect(canStartSection(attempt, 'figure-sequences')).toBe(false);
  });

  it('tracks the running section, the next section and completion', () => {
    const fresh = emptyAttempt(1, START);
    expect(runningSectionId(fresh)).toBeNull();
    expect(nextSectionId(fresh)).toBe('figure-sequences');
    expect(isTestComplete(fresh)).toBe(false);
    expect(submittedSectionCount(fresh)).toBe(0);

    const midway = withStatuses({
      'figure-sequences': 'submitted',
      'mathematical-equations': 'in-progress',
    });
    expect(runningSectionId(midway)).toBe('mathematical-equations');
    expect(nextSectionId(midway)).toBe('mathematical-equations');
    expect(submittedSectionCount(midway)).toBe(1);

    const done = withStatuses({
      'figure-sequences': 'submitted',
      'mathematical-equations': 'submitted',
      'latin-squares': 'submitted',
    });
    expect(runningSectionId(done)).toBeNull();
    expect(nextSectionId(done)).toBeNull();
    expect(isTestComplete(done)).toBe(true);
    expect(submittedSectionCount(done)).toBe(3);
  });
});

describe('useTestSession enforces the rules', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts section 1 and gives it a 25-minute deadline', () => {
    const { result } = renderHook(() => useTestSession(1));

    act(() => {
      expect(result.current.startSection('figure-sequences')).toBe(true);
    });

    const section = result.current.sectionOf('figure-sequences');
    expect(section.status).toBe('in-progress');
    expect(section.startedAt).toBe(START);
    expect(section.endsAt).toBe(START + SECTION_DURATION_MS);
    expect(result.current.runningSection).toBe('figure-sequences');
  });

  it('refuses to start a later section out of order', () => {
    const { result } = renderHook(() => useTestSession(1));

    act(() => {
      expect(result.current.startSection('latin-squares')).toBe(false);
    });

    expect(result.current.sectionOf('latin-squares').status).toBe('not-started');
  });

  it('refuses to restart a section that is already running', () => {
    const { result } = renderHook(() => useTestSession(1));

    act(() => {
      result.current.startSection('figure-sequences');
    });
    const firstDeadline = result.current.sectionOf('figure-sequences').endsAt;

    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    act(() => {
      expect(result.current.startSection('figure-sequences')).toBe(false);
    });

    // The clock was not reset.
    expect(result.current.sectionOf('figure-sequences').endsAt).toBe(firstDeadline);
  });

  it('refuses to restart a submitted section', () => {
    const { result } = renderHook(() => useTestSession(1));

    act(() => {
      result.current.startSection('figure-sequences');
    });
    act(() => {
      result.current.submitSection('figure-sequences');
    });
    act(() => {
      expect(result.current.startSection('figure-sequences')).toBe(false);
    });

    expect(result.current.sectionOf('figure-sequences').status).toBe('submitted');
  });

  it('records the time used on submission and unlocks the next section', () => {
    const { result } = renderHook(() => useTestSession(1));

    act(() => {
      result.current.startSection('figure-sequences');
    });
    act(() => {
      vi.advanceTimersByTime(8 * 60_000);
    });
    act(() => {
      result.current.submitSection('figure-sequences');
    });

    const section = result.current.sectionOf('figure-sequences');
    expect(section.status).toBe('submitted');
    expect(section.timeUsedMs).toBe(8 * 60_000);
    expect(section.autoSubmitted).toBe(false);
    expect(section.endsAt).toBeNull();
    expect(canStartSection(result.current.attempt, 'mathematical-equations')).toBe(true);
  });

  it('ignores answers once a section has been submitted', () => {
    const { result } = renderHook(() => useTestSession(1));
    const question = getTest(1)!.sections[0]!.questions[0]!;

    act(() => {
      result.current.startSection('figure-sequences');
    });
    act(() => {
      result.current.setAnswer('figure-sequences', question.id, [0, 1]);
    });
    act(() => {
      result.current.submitSection('figure-sequences');
    });
    act(() => {
      result.current.setAnswer('figure-sequences', question.id, [2, 2]);
    });

    expect(result.current.sectionOf('figure-sequences').answers[question.id]).toEqual([0, 1]);
  });

  it('ignores answers for a section that was never started', () => {
    const { result } = renderHook(() => useTestSession(1));
    const question = getTest(1)!.sections[2]!.questions[0]!;

    act(() => {
      result.current.setAnswer('latin-squares', question.id, 'A');
    });

    expect(result.current.sectionOf('latin-squares').answers).toEqual({});
  });

  it('caps the time used at the section duration when submitted after the deadline', () => {
    const { result } = renderHook(() => useTestSession(1));

    act(() => {
      result.current.startSection('figure-sequences');
    });
    // The clock ran out two minutes ago (for example while the tab was hidden
    // and its timers were throttled), and only now is the submit processed.
    act(() => {
      vi.setSystemTime(START + SECTION_DURATION_MS + 120_000);
    });
    act(() => {
      result.current.submitSection('figure-sequences', { auto: true });
    });

    const section = result.current.sectionOf('figure-sequences');
    expect(section.status).toBe('submitted');
    expect(section.autoSubmitted).toBe(true);
    // Never more than the 25 minutes the section was worth.
    expect(section.timeUsedMs).toBe(SECTION_DURATION_MS);
  });

  it('auto-submits a section whose deadline passed while the app was closed', () => {
    // Persist a running section whose deadline is already in the past.
    const attempt = withStatuses({ 'figure-sequences': 'in-progress' });
    attempt.sections['figure-sequences']!.endsAt = START - 1_000;
    localStorage.setItem('dmat.attempts.v1', JSON.stringify({ 1: attempt }));

    const { result } = renderHook(() => useTestSession(1));

    const section = result.current.sectionOf('figure-sequences');
    expect(section.status).toBe('submitted');
    expect(section.autoSubmitted).toBe(true);
    expect(loadAttempt(1)!.sections['figure-sequences']!.status).toBe('submitted');
  });

  it('persists answers so a refresh resumes the same section state', () => {
    const question = getTest(1)!.sections[2]!.questions[0] as LatinSquaresQuestion;

    const first = renderHook(() => useTestSession(1));
    act(() => {
      first.result.current.startSection('figure-sequences');
    });
    act(() => {
      first.result.current.submitSection('figure-sequences');
    });
    act(() => {
      first.result.current.startSection('mathematical-equations');
    });
    act(() => {
      first.result.current.submitSection('mathematical-equations');
    });
    act(() => {
      first.result.current.startSection('latin-squares');
    });
    act(() => {
      first.result.current.setAnswer('latin-squares', question.id, question.answer);
      first.result.current.toggleMark('latin-squares', question.id);
      first.result.current.visit('latin-squares', question.id, 4);
    });

    const deadline = first.result.current.sectionOf('latin-squares').endsAt;
    first.unmount();

    // Time passes while the page is closed, then it is reopened.
    act(() => {
      vi.advanceTimersByTime(4 * 60_000);
    });
    const second = renderHook(() => useTestSession(1));
    const restored = second.result.current.sectionOf('latin-squares');

    expect(restored.status).toBe('in-progress');
    expect(restored.endsAt).toBe(deadline);
    expect(restored.answers[question.id]).toBe(question.answer);
    expect(restored.marked).toContain(question.id);
    expect(restored.cursor).toBe(4);
  });

  it('resets the whole attempt on request', () => {
    const { result } = renderHook(() => useTestSession(1));

    act(() => {
      result.current.startSection('figure-sequences');
    });
    act(() => {
      result.current.submitSection('figure-sequences');
    });
    act(() => {
      result.current.resetAttempt();
    });

    expect(result.current.sectionOf('figure-sequences').status).toBe('not-started');
    expect(loadAttempt(1)).toBeNull();
    expect(canStartSection(result.current.attempt, 'figure-sequences')).toBe(true);
  });

  it('allows unlimited time between two sections', () => {
    const { result } = renderHook(() => useTestSession(1));

    act(() => {
      result.current.startSection('figure-sequences');
    });
    act(() => {
      result.current.submitSection('figure-sequences');
    });

    // Two hours go by; the next section is still startable with a full clock.
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 60_000);
    });
    act(() => {
      expect(result.current.startSection('mathematical-equations')).toBe(true);
    });

    const section = result.current.sectionOf('mathematical-equations');
    expect(section.endsAt! - section.startedAt!).toBe(SECTION_DURATION_MS);
  });
});
