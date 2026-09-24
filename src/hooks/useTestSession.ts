import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SECTION_DURATION_MS } from '@/data/examSpec';
import { getTest } from '@/data/questionBank';
import { canStartSection, hasExpired, nextSectionId, runningSectionId } from '@/lib/sessionRules';
import { scoreTest } from '@/lib/scoring';
import { emptyAttempt, loadAttempt, saveAttempt, clearAttempt } from '@/lib/storage';
import type { Answer, MockTest, SectionAttempt, SectionId, TestAttempt, TestScore } from '@/types';

/**
 * Owns one Test Mode attempt: the attempt state, its persistence and the rules
 * for starting and submitting sections.
 *
 * Every mutation writes through to localStorage immediately, so a refresh or a
 * crash mid-section loses nothing — and, because the clock is stored as an
 * absolute deadline, gains nothing either.
 */

export interface TestSession {
  test: MockTest | undefined;
  attempt: TestAttempt;
  score: TestScore | null;
  sectionOf: (sectionId: SectionId) => SectionAttempt;
  startSection: (sectionId: SectionId) => boolean;
  submitSection: (sectionId: SectionId, options?: { auto?: boolean }) => void;
  setAnswer: (sectionId: SectionId, questionId: string, answer: Answer) => void;
  clearAnswer: (sectionId: SectionId, questionId: string) => void;
  toggleMark: (sectionId: SectionId, questionId: string) => void;
  visit: (sectionId: SectionId, questionId: string, index: number) => void;
  recordFullscreenExit: (sectionId: SectionId) => void;
  recordCameraInterruption: (sectionId: SectionId) => void;
  resetAttempt: () => void;
  runningSection: SectionId | null;
  upcomingSection: SectionId | null;
}

export function useTestSession(testId: number): TestSession {
  const test = useMemo(() => getTest(testId), [testId]);
  const [attempt, setAttempt] = useState<TestAttempt>(
    () => loadAttempt(testId) ?? emptyAttempt(testId),
  );

  // Re-seed when the route switches to another mock test.
  const loadedFor = useRef(testId);
  if (loadedFor.current !== testId) {
    loadedFor.current = testId;
  }
  useEffect(() => {
    setAttempt(loadAttempt(testId) ?? emptyAttempt(testId));
  }, [testId]);

  const update = useCallback(
    (mutate: (draft: TestAttempt) => TestAttempt | void) => {
      setAttempt((current) => {
        const draft: TestAttempt = {
          ...current,
          sections: Object.fromEntries(
            Object.entries(current.sections).map(([key, value]) => [
              key,
              {
                ...value,
                answers: { ...value.answers },
                marked: [...value.marked],
                visited: [...value.visited],
              },
            ]),
          ),
        };
        const next = mutate(draft) ?? draft;
        saveAttempt(next);
        return next;
      });
    },
    [],
  );

  const sectionOf = useCallback(
    (sectionId: SectionId): SectionAttempt =>
      attempt.sections[sectionId] ?? {
        status: 'not-started',
        startedAt: null,
        endsAt: null,
        submittedAt: null,
        timeUsedMs: 0,
        autoSubmitted: false,
        fullscreenExits: 0,
        cameraInterruptions: 0,
        answers: {},
        marked: [],
        visited: [],
        cursor: 0,
      },
    [attempt],
  );

  const submitSection = useCallback(
    (sectionId: SectionId, options?: { auto?: boolean }) => {
      update((draft) => {
        const section = draft.sections[sectionId];
        if (!section || section.status !== 'in-progress') return;
        const now = Date.now();
        // A section can never be credited with more than its allotted time.
        const cappedEnd = section.endsAt === null ? now : Math.min(now, section.endsAt);
        section.status = 'submitted';
        section.submittedAt = cappedEnd;
        section.timeUsedMs = section.startedAt === null ? 0 : Math.max(0, cappedEnd - section.startedAt);
        section.autoSubmitted = options?.auto === true;
        section.endsAt = null;
      });
    },
    [update],
  );

  const startSection = useCallback(
    (sectionId: SectionId): boolean => {
      if (!canStartSection(attempt, sectionId)) return false;
      update((draft) => {
        const section = draft.sections[sectionId];
        if (!section || section.status !== 'not-started') return;
        const now = Date.now();
        section.status = 'in-progress';
        section.startedAt = now;
        section.endsAt = now + SECTION_DURATION_MS;
        section.cursor = 0;
        section.autoSubmitted = false;
      });
      return true;
    },
    [attempt, update],
  );

  const setAnswer = useCallback(
    (sectionId: SectionId, questionId: string, answer: Answer) => {
      update((draft) => {
        const section = draft.sections[sectionId];
        if (!section || section.status !== 'in-progress') return;
        section.answers[questionId] = answer;
        if (!section.visited.includes(questionId)) section.visited.push(questionId);
      });
    },
    [update],
  );

  const clearAnswer = useCallback(
    (sectionId: SectionId, questionId: string) => {
      update((draft) => {
        const section = draft.sections[sectionId];
        if (!section || section.status !== 'in-progress') return;
        delete section.answers[questionId];
      });
    },
    [update],
  );

  const toggleMark = useCallback(
    (sectionId: SectionId, questionId: string) => {
      update((draft) => {
        const section = draft.sections[sectionId];
        if (!section || section.status !== 'in-progress') return;
        section.marked = section.marked.includes(questionId)
          ? section.marked.filter((id) => id !== questionId)
          : [...section.marked, questionId];
      });
    },
    [update],
  );

  const visit = useCallback(
    (sectionId: SectionId, questionId: string, index: number) => {
      update((draft) => {
        const section = draft.sections[sectionId];
        if (!section || section.status !== 'in-progress') return;
        if (!section.visited.includes(questionId)) section.visited.push(questionId);
        section.cursor = index;
      });
    },
    [update],
  );

  /** Notes that the test taker left fullscreen while the section was running. */
  const recordFullscreenExit = useCallback(
    (sectionId: SectionId) => {
      update((draft) => {
        const section = draft.sections[sectionId];
        if (!section || section.status !== 'in-progress') return;
        section.fullscreenExits += 1;
      });
    },
    [update],
  );

  /** Notes that the camera stopped while the section was running. */
  const recordCameraInterruption = useCallback(
    (sectionId: SectionId) => {
      update((draft) => {
        const section = draft.sections[sectionId];
        if (!section || section.status !== 'in-progress') return;
        section.cameraInterruptions += 1;
      });
    },
    [update],
  );

  const resetAttempt = useCallback(() => {
    clearAttempt(testId);
    setAttempt(emptyAttempt(testId));
  }, [testId]);

  // A section whose deadline passed while the app was closed is submitted as
  // soon as the attempt is loaded again.
  useEffect(() => {
    const running = runningSectionId(attempt);
    if (running && hasExpired(attempt.sections[running])) {
      submitSection(running, { auto: true });
    }
  }, [attempt, submitSection]);

  const score = useMemo(() => (test ? scoreTest(test, attempt) : null), [test, attempt]);

  return {
    test,
    attempt,
    score,
    sectionOf,
    startSection,
    submitSection,
    setAnswer,
    clearAnswer,
    toggleMark,
    visit,
    recordFullscreenExit,
    recordCameraInterruption,
    resetAttempt,
    runningSection: runningSectionId(attempt),
    upcomingSection: nextSectionId(attempt),
  };
}
