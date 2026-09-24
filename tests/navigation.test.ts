import { describe, expect, it } from 'vitest';

import { getTest } from '@/data/questionBank';
import {
  buildPalette,
  clampIndex,
  firstUnansweredIndex,
  nextIndex,
  paletteCounts,
  paletteStatus,
  previousIndex,
} from '@/lib/navigation';
import type { Answer, LatinSquaresQuestion } from '@/types';

const questions = getTest(1)!.sections[2]!.questions;

describe('palette status', () => {
  it('maps the four tracked states plus "not visited"', () => {
    expect(paletteStatus(undefined, false, false)).toBe('not-visited');
    expect(paletteStatus(undefined, false, true)).toBe('unanswered');
    expect(paletteStatus('C', false, true)).toBe('answered');
    expect(paletteStatus(undefined, true, true)).toBe('marked');
    expect(paletteStatus('C', true, true)).toBe('answered-marked');
  });

  it('counts an answered question as answered even before it was marked visited', () => {
    expect(paletteStatus('C', false, false)).toBe('answered');
  });

  it('treats a blank composite answer as unanswered', () => {
    expect(paletteStatus([null, null], false, true)).toBe('unanswered');
    expect(paletteStatus({ A: null }, false, true)).toBe('unanswered');
  });
});

describe('buildPalette', () => {
  it('produces one entry per question, in order', () => {
    const palette = buildPalette(questions, {}, [], []);
    expect(palette).toHaveLength(20);
    expect(palette[0]).toMatchObject({ index: 0, questionId: questions[0]!.id });
    expect(palette[19]!.index).toBe(19);
  });

  it('reflects answers, marks and visits', () => {
    const answers: Record<string, Answer> = {
      [questions[0]!.id]: (questions[0] as LatinSquaresQuestion).answer,
      [questions[1]!.id]: (questions[1] as LatinSquaresQuestion).answer,
    };
    const palette = buildPalette(
      questions,
      answers,
      [questions[1]!.id, questions[2]!.id],
      [questions[0]!.id, questions[1]!.id, questions[2]!.id, questions[3]!.id],
    );

    expect(palette[0]!.status).toBe('answered');
    expect(palette[1]!.status).toBe('answered-marked');
    expect(palette[2]!.status).toBe('marked');
    expect(palette[3]!.status).toBe('unanswered');
    expect(palette[4]!.status).toBe('not-visited');
  });
});

describe('paletteCounts', () => {
  it('counts answered, unanswered and marked without double counting', () => {
    const answers: Record<string, Answer> = {};
    questions.slice(0, 5).forEach((question) => {
      answers[question.id] = (question as LatinSquaresQuestion).answer;
    });

    const palette = buildPalette(
      questions,
      answers,
      // One answered question and two open ones are marked.
      [questions[4]!.id, questions[10]!.id, questions[11]!.id],
      questions.map((question) => question.id),
    );

    const counts = paletteCounts(palette);
    expect(counts.answered).toBe(5);
    expect(counts.unanswered).toBe(15);
    expect(counts.answered + counts.unanswered).toBe(20);
    expect(counts.marked).toBe(2);
    expect(counts.answeredMarked).toBe(1);
  });
});

describe('cursor movement', () => {
  it('clamps to the valid range', () => {
    expect(clampIndex(-5, 20)).toBe(0);
    expect(clampIndex(0, 20)).toBe(0);
    expect(clampIndex(19, 20)).toBe(19);
    expect(clampIndex(25, 20)).toBe(19);
    expect(clampIndex(3.7, 20)).toBe(3);
  });

  it('returns zero for an empty or nonsensical range', () => {
    expect(clampIndex(4, 0)).toBe(0);
    expect(clampIndex(Number.NaN, 20)).toBe(0);
  });

  it('steps forwards and backwards without falling off either end', () => {
    expect(nextIndex(0, 20)).toBe(1);
    expect(nextIndex(19, 20)).toBe(19);
    expect(previousIndex(5, 20)).toBe(4);
    expect(previousIndex(0, 20)).toBe(0);
  });

  it('allows jumping directly to any question', () => {
    expect(clampIndex(13, questions.length)).toBe(13);
    expect(questions[clampIndex(13, questions.length)]!.id).toBe(questions[13]!.id);
  });
});

describe('firstUnansweredIndex', () => {
  it('finds the first open question', () => {
    const answers: Record<string, Answer> = {
      [questions[0]!.id]: 'A',
      [questions[1]!.id]: 'B',
    };
    expect(firstUnansweredIndex(questions, answers)).toBe(2);
  });

  it('falls back to the first question when everything is answered', () => {
    const answers: Record<string, Answer> = {};
    questions.forEach((question) => {
      answers[question.id] = (question as LatinSquaresQuestion).answer;
    });
    expect(firstUnansweredIndex(questions, answers)).toBe(0);
  });
});
