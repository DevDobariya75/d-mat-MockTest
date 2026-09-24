import { SECTION_SPEC_BY_ID } from '@/data/examSpec';
import type {
  Answer,
  FigureSequenceAnswer,
  FigureSequenceQuestion,
  LatinSquaresAnswer,
  LatinSquaresQuestion,
  MathEquationsAnswer,
  MathEquationsQuestion,
  MockTest,
  Question,
  QuestionOutcome,
  QuestionScore,
  SectionAttempt,
  SectionScore,
  TestAttempt,
  TestScore,
} from '@/types';

/**
 * Marking scheme.
 *
 * The preparatory materials tell test takers to guess rather than leave a task
 * open, so there is no negative marking: every task is worth one point, a wrong
 * or missing answer scores zero.
 *
 * A figure sequence asks for two matrices ("Image 1" and "Image 2"), so its
 * single point is split into two halves. A task counts as `correct` only when
 * both halves are right and as `partial` when exactly one is.
 *
 * See `docs/DMAT_EXAM_SPEC.md` for the rationale.
 */

export const MAX_POINTS_PER_QUESTION = 1;

export const isBlank = (answer: Answer | undefined): boolean => {
  if (answer === undefined || answer === null) return true;
  if (Array.isArray(answer)) return answer.every((value) => value === null);
  if (typeof answer === 'object') {
    return Object.values(answer).every((value) => value === null || value === undefined);
  }
  return false;
};

/**
 * Whether a question can safely reveal its solution the moment it is complete.
 *
 * Click-based tasks can: the last click is unambiguously the final answer. A
 * typed answer cannot, because a partially typed number (`1` on the way to `18`)
 * already looks like a complete answer, so those tasks are committed explicitly.
 */
export const questionAutoReveals = (question: Question): boolean =>
  question.type !== 'math-equations';

/**
 * True when every part of a question has been answered.
 *
 * A figure series needs both images and an equation system needs every unknown,
 * so "not blank" is not the same as "finished". Practice Mode waits for this
 * before revealing the solution, otherwise picking the first of two images would
 * give the second one away.
 */
export function isComplete(question: Question, answer: Answer | undefined): boolean {
  if (answer === undefined || answer === null) return false;

  switch (question.type) {
    case 'figure-sequence': {
      if (!Array.isArray(answer)) return false;
      return question.answer.every((_, blank) => typeof answer[blank] === 'number');
    }
    case 'math-equations': {
      if (typeof answer !== 'object' || Array.isArray(answer)) return false;
      const values = answer as MathEquationsAnswer;
      return question.variables.every((name) => typeof values[name] === 'number');
    }
    case 'latin-squares':
      return typeof answer === 'string' && answer.length > 0;
  }
}

function scoreFigureSequence(
  question: FigureSequenceQuestion,
  answer: FigureSequenceAnswer | undefined,
): { points: number; outcome: QuestionOutcome } {
  if (!answer || isBlank(answer)) return { points: 0, outcome: 'unanswered' };
  let hits = 0;
  for (let blank = 0; blank < question.answer.length; blank += 1) {
    if (answer[blank] !== null && answer[blank] === question.answer[blank]) hits += 1;
  }
  const points = hits / question.answer.length;
  if (hits === question.answer.length) return { points, outcome: 'correct' };
  if (hits === 0) return { points: 0, outcome: 'incorrect' };
  return { points, outcome: 'partial' };
}

function scoreMathEquations(
  question: MathEquationsQuestion,
  answer: MathEquationsAnswer | undefined,
): { points: number; outcome: QuestionOutcome } {
  if (!answer || isBlank(answer)) return { points: 0, outcome: 'unanswered' };
  const allCorrect = question.variables.every((name) => answer[name] === question.answer[name]);
  return allCorrect
    ? { points: MAX_POINTS_PER_QUESTION, outcome: 'correct' }
    : { points: 0, outcome: 'incorrect' };
}

function scoreLatinSquares(
  question: LatinSquaresQuestion,
  answer: LatinSquaresAnswer | undefined,
): { points: number; outcome: QuestionOutcome } {
  if (!answer) return { points: 0, outcome: 'unanswered' };
  return answer === question.answer
    ? { points: MAX_POINTS_PER_QUESTION, outcome: 'correct' }
    : { points: 0, outcome: 'incorrect' };
}

export function scoreQuestion(question: Question, answer: Answer | undefined): QuestionScore {
  let result: { points: number; outcome: QuestionOutcome };
  switch (question.type) {
    case 'figure-sequence':
      result = scoreFigureSequence(question, answer as FigureSequenceAnswer | undefined);
      break;
    case 'math-equations':
      result = scoreMathEquations(question, answer as MathEquationsAnswer | undefined);
      break;
    case 'latin-squares':
      result = scoreLatinSquares(question, answer as LatinSquaresAnswer | undefined);
      break;
  }
  return {
    questionId: question.id,
    outcome: result.outcome,
    points: result.points,
    maxPoints: MAX_POINTS_PER_QUESTION,
  };
}

/** True when the answer earns full marks — used for Practice Mode feedback. */
export function isFullyCorrect(question: Question, answer: Answer | undefined): boolean {
  return scoreQuestion(question, answer).outcome === 'correct';
}

export function scoreSection(
  section: MockTest['sections'][number],
  attempt: SectionAttempt | undefined,
): SectionScore {
  const questions = section.questions.map((question) =>
    scoreQuestion(question, attempt?.answers[question.id]),
  );

  const points = questions.reduce((sum, item) => sum + item.points, 0);
  const maxPoints = questions.length * MAX_POINTS_PER_QUESTION;
  const count = (outcome: QuestionOutcome) =>
    questions.filter((item) => item.outcome === outcome).length;

  const unanswered = count('unanswered');
  const attempted = questions.length - unanswered;

  return {
    sectionId: section.id,
    title: SECTION_SPEC_BY_ID[section.id]?.title ?? section.title,
    points,
    maxPoints,
    correct: count('correct'),
    partial: count('partial'),
    incorrect: count('incorrect'),
    unanswered,
    total: questions.length,
    percentage: maxPoints === 0 ? 0 : points / maxPoints,
    accuracy: attempted === 0 ? 0 : points / attempted,
    timeUsedMs: attempt?.timeUsedMs ?? 0,
    autoSubmitted: attempt?.autoSubmitted ?? false,
    fullscreenExits: attempt?.fullscreenExits ?? 0,
    cameraInterruptions: attempt?.cameraInterruptions ?? 0,
    questions,
  };
}

export function scoreTest(test: MockTest, attempt: TestAttempt | undefined): TestScore {
  const sections = test.sections.map((section) =>
    scoreSection(section, attempt?.sections[section.id]),
  );

  const sum = (pick: (section: SectionScore) => number) =>
    sections.reduce((total, section) => total + pick(section), 0);

  const points = sum((section) => section.points);
  const maxPoints = sum((section) => section.maxPoints);
  const total = sum((section) => section.total);
  const unanswered = sum((section) => section.unanswered);
  const attempted = total - unanswered;

  return {
    testId: test.id,
    points,
    maxPoints,
    percentage: maxPoints === 0 ? 0 : points / maxPoints,
    correct: sum((section) => section.correct),
    partial: sum((section) => section.partial),
    incorrect: sum((section) => section.incorrect),
    unanswered,
    total,
    accuracy: attempted === 0 ? 0 : points / attempted,
    timeUsedMs: sum((section) => section.timeUsedMs),
    sections,
  };
}

/** Formats points for display: whole numbers stay whole, halves keep one decimal. */
export const formatPoints = (points: number): string =>
  Number.isInteger(points) ? String(points) : points.toFixed(1);

export const formatPercent = (ratio: number): string => `${Math.round(ratio * 100)}%`;

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
