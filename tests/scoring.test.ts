import { describe, expect, it } from 'vitest';

import { getTest } from '@/data/questionBank';
import {
  formatPercent,
  formatPoints,
  isBlank,
  isFullyCorrect,
  scoreQuestion,
  scoreSection,
  scoreTest,
} from '@/lib/scoring';
import { emptyAttempt, emptySectionAttempt } from '@/lib/storage';
import type {
  FigureSequenceQuestion,
  LatinSquaresQuestion,
  MathEquationsQuestion,
  SectionAttempt,
  TestAttempt,
} from '@/types';

const test1 = getTest(1)!;
const figureSection = test1.sections[0]!;
const equationSection = test1.sections[1]!;
const latinSection = test1.sections[2]!;

const figureQuestion = figureSection.questions[0] as FigureSequenceQuestion;
const equationQuestion = equationSection.questions[0] as MathEquationsQuestion;
const latinQuestion = latinSection.questions[0] as LatinSquaresQuestion;

const otherOption = (correct: number): number => (correct + 1) % 3;

describe('isBlank', () => {
  it('recognises every shape of empty answer', () => {
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank(null)).toBe(true);
    expect(isBlank([null, null])).toBe(true);
    expect(isBlank({ A: null, B: null })).toBe(true);
  });

  it('recognises partially filled answers as not blank', () => {
    expect(isBlank([0, null])).toBe(false);
    expect(isBlank({ A: 3, B: null })).toBe(false);
    expect(isBlank('C')).toBe(false);
  });
});

describe('figure sequence marking', () => {
  it('awards a full point when both images are right', () => {
    const score = scoreQuestion(figureQuestion, [...figureQuestion.answer]);
    expect(score).toMatchObject({ outcome: 'correct', points: 1, maxPoints: 1 });
  });

  it('awards half a point when exactly one image is right', () => {
    const score = scoreQuestion(figureQuestion, [
      figureQuestion.answer[0]!,
      otherOption(figureQuestion.answer[1]!),
    ]);
    expect(score.outcome).toBe('partial');
    expect(score.points).toBe(0.5);
  });

  it('awards half a point when only one image is answered and it is right', () => {
    const score = scoreQuestion(figureQuestion, [figureQuestion.answer[0]!, null]);
    expect(score.outcome).toBe('partial');
    expect(score.points).toBe(0.5);
  });

  it('awards nothing when both images are wrong', () => {
    const score = scoreQuestion(figureQuestion, [
      otherOption(figureQuestion.answer[0]!),
      otherOption(figureQuestion.answer[1]!),
    ]);
    expect(score).toMatchObject({ outcome: 'incorrect', points: 0 });
  });

  it('counts an untouched series as unanswered, never as incorrect', () => {
    expect(scoreQuestion(figureQuestion, undefined).outcome).toBe('unanswered');
    expect(scoreQuestion(figureQuestion, [null, null]).outcome).toBe('unanswered');
  });
});

describe('mathematical equations marking', () => {
  it('awards a point only when every unknown is right', () => {
    const score = scoreQuestion(equationQuestion, { ...equationQuestion.answer });
    expect(score).toMatchObject({ outcome: 'correct', points: 1 });
  });

  it('gives no partial credit for a partly solved system', () => {
    const [first, ...rest] = equationQuestion.variables;
    const answer: Record<string, number | null> = { [first!]: equationQuestion.answer[first!]! };
    for (const name of rest) answer[name] = null;

    const score = scoreQuestion(equationQuestion, answer);
    expect(score).toMatchObject({ outcome: 'incorrect', points: 0 });
  });

  it('marks a wrong value as incorrect', () => {
    const answer: Record<string, number | null> = {};
    for (const name of equationQuestion.variables) {
      answer[name] = equationQuestion.answer[name]!;
    }
    const first = equationQuestion.variables[0]!;
    answer[first] = (equationQuestion.answer[first]! % 20) + 1;

    expect(scoreQuestion(equationQuestion, answer).outcome).toBe('incorrect');
  });
});

describe('latin squares marking', () => {
  it('awards a point for the forced letter', () => {
    expect(scoreQuestion(latinQuestion, latinQuestion.answer)).toMatchObject({
      outcome: 'correct',
      points: 1,
    });
  });

  it('marks any other letter as incorrect', () => {
    const wrong = latinQuestion.options.find((letter) => letter !== latinQuestion.answer)!;
    expect(scoreQuestion(latinQuestion, wrong)).toMatchObject({
      outcome: 'incorrect',
      points: 0,
    });
  });

  it('treats a missing letter as unanswered', () => {
    expect(scoreQuestion(latinQuestion, null).outcome).toBe('unanswered');
  });
});

describe('isFullyCorrect', () => {
  it('is only true for a fully correct answer', () => {
    expect(isFullyCorrect(latinQuestion, latinQuestion.answer)).toBe(true);
    expect(isFullyCorrect(figureQuestion, [figureQuestion.answer[0]!, null])).toBe(false);
  });
});

describe('section aggregation', () => {
  const sectionWith = (answers: SectionAttempt['answers']): SectionAttempt => ({
    ...emptySectionAttempt(),
    status: 'submitted',
    timeUsedMs: 12 * 60_000,
    answers,
  });

  it('sums points, tallies outcomes and derives percentage and accuracy', () => {
    // Answer the first ten Latin squares: seven right, three wrong.
    const answers: SectionAttempt['answers'] = {};
    latinSection.questions.slice(0, 7).forEach((question) => {
      answers[question.id] = (question as LatinSquaresQuestion).answer;
    });
    latinSection.questions.slice(7, 10).forEach((question) => {
      const latin = question as LatinSquaresQuestion;
      answers[latin.id] = latin.options.find((letter) => letter !== latin.answer)!;
    });

    const score = scoreSection(latinSection, sectionWith(answers));

    expect(score.total).toBe(20);
    expect(score.correct).toBe(7);
    expect(score.incorrect).toBe(3);
    expect(score.unanswered).toBe(10);
    expect(score.points).toBe(7);
    expect(score.maxPoints).toBe(20);
    expect(score.percentage).toBeCloseTo(7 / 20);
    // Accuracy only counts the ten attempted tasks.
    expect(score.accuracy).toBeCloseTo(7 / 10);
    expect(score.timeUsedMs).toBe(12 * 60_000);
    expect(score.questions).toHaveLength(20);
  });

  it('reports zero accuracy rather than NaN when nothing was attempted', () => {
    const score = scoreSection(latinSection, sectionWith({}));
    expect(score.accuracy).toBe(0);
    expect(score.percentage).toBe(0);
    expect(score.unanswered).toBe(20);
  });

  it('includes partial credit in the points but keeps the tallies separate', () => {
    const answers: SectionAttempt['answers'] = {};
    const target = figureSection.questions[0] as FigureSequenceQuestion;
    answers[target.id] = [target.answer[0]!, otherOption(target.answer[1]!)];

    const score = scoreSection(figureSection, sectionWith(answers));
    expect(score.partial).toBe(1);
    expect(score.correct).toBe(0);
    expect(score.incorrect).toBe(0);
    expect(score.points).toBe(0.5);
    expect(score.accuracy).toBeCloseTo(0.5);
  });

  it('carries the auto-submitted flag through to the report', () => {
    const score = scoreSection(latinSection, {
      ...sectionWith({}),
      autoSubmitted: true,
    });
    expect(score.autoSubmitted).toBe(true);
  });
});

describe('test aggregation', () => {
  it('scores a perfect attempt as 60 out of 60', () => {
    const attempt: TestAttempt = emptyAttempt(1);
    for (const section of test1.sections) {
      const sectionAttempt = attempt.sections[section.id]!;
      sectionAttempt.status = 'submitted';
      sectionAttempt.timeUsedMs = 25 * 60_000;
      for (const question of section.questions) {
        switch (question.type) {
          case 'figure-sequence':
            sectionAttempt.answers[question.id] = [...question.answer];
            break;
          case 'math-equations':
            sectionAttempt.answers[question.id] = { ...question.answer };
            break;
          case 'latin-squares':
            sectionAttempt.answers[question.id] = question.answer;
            break;
        }
      }
    }

    const score = scoreTest(test1, attempt);
    expect(score.maxPoints).toBe(60);
    expect(score.points).toBe(60);
    expect(score.correct).toBe(60);
    expect(score.unanswered).toBe(0);
    expect(score.percentage).toBe(1);
    expect(score.accuracy).toBe(1);
    expect(score.timeUsedMs).toBe(75 * 60_000);
    expect(score.sections).toHaveLength(3);
  });

  it('scores an empty attempt as zero out of 60 with everything unanswered', () => {
    const score = scoreTest(test1, emptyAttempt(1));
    expect(score.points).toBe(0);
    expect(score.maxPoints).toBe(60);
    expect(score.unanswered).toBe(60);
    expect(score.accuracy).toBe(0);
  });

  it('handles a missing attempt without throwing', () => {
    const score = scoreTest(test1, undefined);
    expect(score.points).toBe(0);
    expect(score.total).toBe(60);
  });
});

describe('formatters', () => {
  it('keeps whole points whole and shows halves with one decimal', () => {
    expect(formatPoints(17)).toBe('17');
    expect(formatPoints(17.5)).toBe('17.5');
  });

  it('renders percentages as rounded whole numbers', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.666)).toBe('67%');
    expect(formatPercent(1)).toBe('100%');
  });
});
