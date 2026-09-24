import { useCallback, useEffect, useMemo, useState } from 'react';

import { SECTION_SPECS } from '@/data/examSpec';
import { getTest } from '@/data/questionBank';
import { isComplete, questionAutoReveals, scoreQuestion } from '@/lib/scoring';
import {
  clearPracticeProgress,
  loadPracticeProgress,
  savePracticeProgress,
} from '@/lib/storage';
import type { Answer, MockTest, PracticeProgress, Question, SectionId } from '@/types';

/**
 * Owns one Practice Mode session.
 *
 * Practice Mode has no clock and no section locking: every section and every
 * question is reachable at any time. Answering a question reveals whether it
 * was right, together with the correct answer and the explanation.
 */

export interface PracticeSession {
  test: MockTest | undefined;
  sectionId: SectionId;
  setSectionId: (sectionId: SectionId) => void;
  questions: Question[];
  cursor: number;
  goTo: (index: number) => void;
  next: () => void;
  previous: () => void;
  answers: Record<string, Answer>;
  answerOf: (questionId: string) => Answer | undefined;
  submitAnswer: (questionId: string, answer: Answer) => void;
  revealAnswer: (questionId: string) => void;
  isRevealed: (questionId: string) => boolean;
  retry: (questionId: string) => void;
  reset: () => void;
  progress: { answered: number; correct: number; total: number };
}

const emptyProgress = (testId: number): PracticeProgress => ({
  testId,
  answers: {},
  revealed: [],
  lastSectionId: SECTION_SPECS[0]!.id,
  cursor: 0,
  updatedAt: Date.now(),
});

export function usePracticeSession(testId: number): PracticeSession {
  const test = useMemo(() => getTest(testId), [testId]);
  const [progress, setProgress] = useState<PracticeProgress>(
    () => loadPracticeProgress(testId) ?? emptyProgress(testId),
  );

  useEffect(() => {
    setProgress(loadPracticeProgress(testId) ?? emptyProgress(testId));
  }, [testId]);

  const update = useCallback((mutate: (draft: PracticeProgress) => void) => {
    setProgress((current) => {
      const draft: PracticeProgress = {
        ...current,
        answers: { ...current.answers },
        revealed: [...current.revealed],
      };
      mutate(draft);
      draft.updatedAt = Date.now();
      savePracticeProgress(draft);
      return draft;
    });
  }, []);

  const sectionId = progress.lastSectionId;
  const section = test?.sections.find((candidate) => candidate.id === sectionId);
  const questions = section?.questions ?? [];
  const cursor = Math.min(progress.cursor, Math.max(0, questions.length - 1));

  const setSectionId = useCallback(
    (nextSection: SectionId) => {
      update((draft) => {
        draft.lastSectionId = nextSection;
        draft.cursor = 0;
      });
    },
    [update],
  );

  const goTo = useCallback(
    (index: number) => {
      update((draft) => {
        draft.cursor = Math.max(0, index);
      });
    },
    [update],
  );

  const next = useCallback(() => {
    update((draft) => {
      draft.cursor = Math.min(draft.cursor + 1, Math.max(0, questions.length - 1));
    });
  }, [questions.length, update]);

  const previous = useCallback(() => {
    update((draft) => {
      draft.cursor = Math.max(draft.cursor - 1, 0);
    });
  }, [update]);

  const submitAnswer = useCallback(
    (questionId: string, answer: Answer) => {
      const question = questions.find((candidate) => candidate.id === questionId);
      update((draft) => {
        draft.answers[questionId] = answer;

        // Feedback appears once every part of the task has been answered — not
        // on the first of two images, and not on the first of several unknowns.
        //
        // Typed answers are the exception: "B = 1" looks finished the moment the
        // first digit of "18" is entered, so revealing there would lock the field
        // mid-number. Those tasks are committed explicitly instead.
        const finished = question ? isComplete(question, answer) : false;
        const autoReveal = question ? questionAutoReveals(question) : false;

        if (finished && autoReveal) {
          if (!draft.revealed.includes(questionId)) draft.revealed.push(questionId);
        } else if (!finished) {
          draft.revealed = draft.revealed.filter((id) => id !== questionId);
        }
      });
    },
    [questions, update],
  );

  /** Gives up on a task and shows the solution, however much was filled in. */
  const revealAnswer = useCallback(
    (questionId: string) => {
      update((draft) => {
        if (!draft.revealed.includes(questionId)) draft.revealed.push(questionId);
      });
    },
    [update],
  );

  const retry = useCallback(
    (questionId: string) => {
      update((draft) => {
        delete draft.answers[questionId];
        draft.revealed = draft.revealed.filter((id) => id !== questionId);
      });
    },
    [update],
  );

  const reset = useCallback(() => {
    clearPracticeProgress(testId);
    setProgress(emptyProgress(testId));
  }, [testId]);

  const stats = useMemo(() => {
    let answered = 0;
    let correct = 0;
    for (const question of questions) {
      const answer = progress.answers[question.id];
      // Only finished tasks count as attempted; a half-filled one is still open.
      if (!isComplete(question, answer)) continue;
      answered += 1;
      if (scoreQuestion(question, answer).outcome === 'correct') correct += 1;
    }
    return { answered, correct, total: questions.length };
  }, [questions, progress.answers]);

  return {
    test,
    sectionId,
    setSectionId,
    questions,
    cursor,
    goTo,
    next,
    previous,
    answers: progress.answers,
    answerOf: (questionId: string) => progress.answers[questionId],
    submitAnswer,
    revealAnswer,
    isRevealed: (questionId: string) => progress.revealed.includes(questionId),
    retry,
    reset,
    progress: stats,
  };
}
