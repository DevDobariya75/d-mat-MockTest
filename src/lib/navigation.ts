import { isBlank } from '@/lib/scoring';
import type { Answer, Question } from '@/types';

export type PaletteStatus =
  | 'unanswered'
  | 'answered'
  | 'marked'
  | 'answered-marked'
  | 'not-visited';

export interface PaletteEntry {
  index: number;
  questionId: string;
  status: PaletteStatus;
}

/**
 * Navigation helpers shared by the question palette and the previous/next
 * buttons. Kept free of React so they can be unit-tested directly.
 */

export function paletteStatus(
  answer: Answer | undefined,
  marked: boolean,
  visited: boolean,
): PaletteStatus {
  const answered = !isBlank(answer);
  if (answered && marked) return 'answered-marked';
  if (marked) return 'marked';
  if (answered) return 'answered';
  return visited ? 'unanswered' : 'not-visited';
}

export function buildPalette(
  questions: Question[],
  answers: Record<string, Answer>,
  marked: string[],
  visited: string[],
): PaletteEntry[] {
  const markedSet = new Set(marked);
  const visitedSet = new Set(visited);
  return questions.map((question, index) => ({
    index,
    questionId: question.id,
    status: paletteStatus(
      answers[question.id],
      markedSet.has(question.id),
      visitedSet.has(question.id),
    ),
  }));
}

export const clampIndex = (index: number, length: number): number => {
  if (length <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), length - 1);
};

export const nextIndex = (index: number, length: number): number =>
  clampIndex(index + 1, length);

export const previousIndex = (index: number, length: number): number =>
  clampIndex(index - 1, length);

/** Index of the first question that is neither answered nor already passed. */
export function firstUnansweredIndex(
  questions: Question[],
  answers: Record<string, Answer>,
): number {
  const index = questions.findIndex((question) => isBlank(answers[question.id]));
  return index < 0 ? 0 : index;
}

export interface PaletteCounts {
  answered: number;
  unanswered: number;
  marked: number;
  answeredMarked: number;
}

export function paletteCounts(entries: PaletteEntry[]): PaletteCounts {
  const counts: PaletteCounts = { answered: 0, unanswered: 0, marked: 0, answeredMarked: 0 };
  for (const entry of entries) {
    switch (entry.status) {
      case 'answered':
        counts.answered += 1;
        break;
      case 'answered-marked':
        counts.answered += 1;
        counts.answeredMarked += 1;
        break;
      case 'marked':
        counts.marked += 1;
        counts.unanswered += 1;
        break;
      default:
        counts.unanswered += 1;
    }
  }
  return counts;
}
