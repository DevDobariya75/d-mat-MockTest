import { describe, expect, it } from 'vitest';

import { DIFFICULTY_PLAN, QUESTIONS_PER_SECTION, TOTAL_TESTS } from '@/data/examSpec';
import { mockTests } from '@/data/questionBank';
import { buildBank } from '@/lib/buildBank';
import {
  equationSignature,
  figureMovementSignature,
  latinSignature,
  questionSignature,
  signaturesOf,
} from '@/lib/signature';
import type { Difficulty, Question, SectionId } from '@/types';

/**
 * Bank-wide integrity: the difficulty mix of every mock test, and the guarantee
 * that no task repeats anywhere across the ten tests.
 *
 * `npm run audit:bank` prints the same checks as a readable report.
 */

const allQuestions = (): Question[] =>
  mockTests.flatMap((test) => test.sections.flatMap((section) => section.questions));

const LEVELS: Difficulty[] = ['low', 'medium', 'high'];
const SECTION_IDS: SectionId[] = [
  'figure-sequences',
  'mathematical-equations',
  'latin-squares',
];

const planCount = (level: Difficulty) => DIFFICULTY_PLAN.filter((item) => item === level).length;

const questionsOf = (sectionId: SectionId, level?: Difficulty): Question[] =>
  mockTests
    .flatMap((test) => test.sections.filter((section) => section.id === sectionId))
    .flatMap((section) => section.questions)
    .filter((question) => level === undefined || question.difficulty === level);

describe('difficulty mix is maintained in every mock test', () => {
  it('plans 6 low, 8 medium and 6 high per section', () => {
    expect(DIFFICULTY_PLAN).toHaveLength(QUESTIONS_PER_SECTION);
    expect(planCount('low')).toBe(6);
    expect(planCount('medium')).toBe(8);
    expect(planCount('high')).toBe(6);
  });

  it('gives every one of the 30 sections that exact mix', () => {
    let checked = 0;
    for (const test of mockTests) {
      for (const section of test.sections) {
        for (const level of LEVELS) {
          const count = section.questions.filter((q) => q.difficulty === level).length;
          expect(count, `test ${test.id} / ${section.id}: ${level}`).toBe(planCount(level));
        }
        checked += 1;
      }
    }
    expect(checked).toBe(TOTAL_TESTS * SECTION_IDS.length);
  });

  it('orders every section from easy to hard', () => {
    for (const test of mockTests) {
      for (const section of test.sections) {
        expect(
          section.questions.map((q) => q.difficulty),
          `test ${test.id} / ${section.id}`,
        ).toEqual(DIFFICULTY_PLAN);
      }
    }
  });

  it('gives every mock test the same overall mix of 18 / 24 / 18', () => {
    for (const test of mockTests) {
      const all = test.sections.flatMap((section) => section.questions);
      expect(all, `test ${test.id}`).toHaveLength(60);
      expect(all.filter((q) => q.difficulty === 'low'), `test ${test.id}`).toHaveLength(18);
      expect(all.filter((q) => q.difficulty === 'medium'), `test ${test.id}`).toHaveLength(24);
      expect(all.filter((q) => q.difficulty === 'high'), `test ${test.id}`).toHaveLength(18);
    }
  });

  it('adds up to 180 low, 240 medium and 180 high across the bank', () => {
    const all = allQuestions();
    expect(all).toHaveLength(600);
    expect(all.filter((q) => q.difficulty === 'low')).toHaveLength(180);
    expect(all.filter((q) => q.difficulty === 'medium')).toHaveLength(240);
    expect(all.filter((q) => q.difficulty === 'high')).toHaveLength(180);
  });
});

describe('the difficulty label reflects the actual task', () => {
  /** The property that makes each subtest harder. */
  const measure = (question: Question): number => {
    switch (question.type) {
      case 'figure-sequence':
        return question.given[0]!.figures.length;
      case 'math-equations':
        return question.variables.length;
      case 'latin-squares':
        return question.explanation.length;
    }
  };

  const rangeOf = (sectionId: SectionId, level: Difficulty) => {
    const values = questionsOf(sectionId, level).map(measure);
    expect(values.length).toBeGreaterThan(0);
    return { min: Math.min(...values), max: Math.max(...values) };
  };

  const meanOf = (sectionId: SectionId, level: Difficulty) => {
    const values = questionsOf(sectionId, level).map(measure);
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  it.each(SECTION_IDS)('escalates from low to medium to high in %s', (sectionId) => {
    const low = rangeOf(sectionId, 'low');
    const medium = rangeOf(sectionId, 'medium');
    const high = rangeOf(sectionId, 'high');

    // Each level shifts upwards: its floor and ceiling both rise, and its
    // ceiling rises strictly. Ranges may still overlap — the Latin Squares step
    // count is a noisy measure, and its strictly separated knob is the clue
    // count, checked on its own below.
    expect(medium.min, 'medium floor vs low').toBeGreaterThanOrEqual(low.min);
    expect(medium.max, 'medium ceiling vs low').toBeGreaterThan(low.max);
    expect(high.min, 'high floor vs medium').toBeGreaterThanOrEqual(medium.min);
    expect(high.max, 'high ceiling vs medium').toBeGreaterThan(medium.max);

    // And the averages separate clearly, so the levels really differ.
    expect(meanOf(sectionId, 'medium'), 'medium mean').toBeGreaterThan(
      meanOf(sectionId, 'low'),
    );
    expect(meanOf(sectionId, 'high'), 'high mean').toBeGreaterThan(
      meanOf(sectionId, 'medium'),
    );
  });

  it('gives figure series 1, then 2-3, then 3-4 figures', () => {
    expect(rangeOf('figure-sequences', 'low')).toEqual({ min: 1, max: 1 });
    expect(rangeOf('figure-sequences', 'medium').min).toBe(2);
    expect(rangeOf('figure-sequences', 'high').min).toBeGreaterThanOrEqual(3);
    expect(rangeOf('figure-sequences', 'high').max).toBeLessThanOrEqual(4);
  });

  it('gives equation systems 2, then 3, then 4 unknowns', () => {
    expect(rangeOf('mathematical-equations', 'low')).toEqual({ min: 2, max: 2 });
    expect(rangeOf('mathematical-equations', 'medium')).toEqual({ min: 3, max: 3 });
    expect(rangeOf('mathematical-equations', 'high')).toEqual({ min: 4, max: 4 });
  });

  it('leaves fewer Latin Square clues as the level rises', () => {
    const clues = (level: Difficulty) =>
      questionsOf('latin-squares', level).map((question) =>
        question.type === 'latin-squares'
          ? question.grid.flat().filter((cell) => cell !== null).length
          : 0,
      );

    expect(Math.min(...clues('low'))).toBeGreaterThan(Math.max(...clues('medium')));
    expect(Math.min(...clues('medium'))).toBeGreaterThan(Math.max(...clues('high')));
  });
});

describe('no question repeats anywhere in the bank', () => {
  it('uses 600 distinct question ids', () => {
    const ids = allQuestions().map((question) => question.id);
    expect(ids).toHaveLength(600);
    expect(new Set(ids).size).toBe(600);
  });

  it('has no two tasks with the same canonical signature', () => {
    const groups = new Map<string, string[]>();
    for (const question of allQuestions()) {
      const signature = questionSignature(question);
      if (!groups.has(signature)) groups.set(signature, []);
      groups.get(signature)!.push(question.id);
    }
    const repeats = [...groups.values()].filter((ids) => ids.length > 1);
    expect(repeats.map((ids) => ids.join(' = ')), 'repeated tasks').toEqual([]);
    expect(groups.size).toBe(600);
  });

  it('has no repeat under any weaker notion of sameness either', () => {
    const byNotion = new Map<string, Map<string, string[]>>();
    for (const question of allQuestions()) {
      for (const [notion, signature] of Object.entries(signaturesOf(question))) {
        if (!byNotion.has(notion)) byNotion.set(notion, new Map());
        const groups = byNotion.get(notion)!;
        if (!groups.has(signature)) groups.set(signature, []);
        groups.get(signature)!.push(question.id);
      }
    }

    expect(byNotion.size).toBe(6); // two notions per subtest
    for (const [notion, groups] of byNotion) {
      const repeats = [...groups.values()].filter((ids) => ids.length > 1);
      expect(repeats.map((ids) => ids.join(' = ')), notion).toEqual([]);
      expect(groups.size, notion).toBe(200);
    }
  });

  it('never repeats a figure movement path, even across different tests', () => {
    // The case a byte-comparison misses: the same path drawn with a different
    // shape or colour is still the same puzzle.
    const paths = new Map<string, string[]>();
    for (const question of allQuestions()) {
      if (question.type !== 'figure-sequence') continue;
      const path = figureMovementSignature(question);
      if (!paths.has(path)) paths.set(path, []);
      paths.get(path)!.push(question.id);
    }
    expect(paths.size).toBe(200);
    expect([...paths.values()].filter((ids) => ids.length > 1)).toEqual([]);
  });

  it('never repeats an equation system, whatever the letters are called', () => {
    const systems = new Set(
      allQuestions()
        .filter((question) => question.type === 'math-equations')
        .map(equationSignature),
    );
    expect(systems.size).toBe(200);
  });

  it('never repeats a Latin Square grid and target field', () => {
    const grids = new Set(
      allQuestions()
        .filter((question) => question.type === 'latin-squares')
        .map(latinSignature),
    );
    expect(grids.size).toBe(200);
  });

  it('has no byte-identical questions once the id is ignored', () => {
    const seen = new Set<string>();
    for (const question of allQuestions()) {
      const { id: _id, ...rest } = question;
      seen.add(JSON.stringify(rest));
    }
    expect(seen.size).toBe(600);
  });
});

describe('answers are spread across the options', () => {
  it('does not favour one response matrix in the figure series', () => {
    const counts = [0, 0, 0];
    for (const question of allQuestions()) {
      if (question.type !== 'figure-sequence') continue;
      for (const index of question.answer) counts[index]! += 1;
    }
    const total = counts.reduce((a, b) => a + b, 0);
    expect(total).toBe(400); // 200 series x 2 images
    for (const count of counts) {
      // Within 25% of an even split, so guessing one option is no strategy.
      expect(count).toBeGreaterThan((total / 3) * 0.75);
      expect(count).toBeLessThan((total / 3) * 1.25);
    }
  });

  it('uses all five letters as Latin Square answers', () => {
    const counts = new Map<string, number>();
    for (const question of allQuestions()) {
      if (question.type !== 'latin-squares') continue;
      counts.set(question.answer, (counts.get(question.answer) ?? 0) + 1);
    }
    expect(counts.size).toBe(5);
    for (const [letter, count] of counts) {
      expect(count, `letter ${letter}`).toBeGreaterThan(200 / 5 / 2);
    }
  });
});

describe('global de-duplication survives regeneration', () => {
  it('produces 600 distinct signatures from a different seed too', () => {
    const rebuilt = buildBank(777);
    const signatures = new Set<string>();
    let count = 0;
    for (const test of rebuilt.tests) {
      for (const section of test.sections) {
        for (const question of section.questions) {
          signatures.add(questionSignature(question));
          count += 1;
        }
      }
    }
    expect(count).toBe(600);
    expect(signatures.size).toBe(600);
  });

  it('keeps the difficulty plan when regenerated', () => {
    const rebuilt = buildBank(777);
    for (const test of rebuilt.tests) {
      for (const section of test.sections) {
        expect(section.questions.map((q) => q.difficulty)).toEqual(DIFFICULTY_PLAN);
      }
    }
  });
});
