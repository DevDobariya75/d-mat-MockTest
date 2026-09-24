import { describe, expect, it } from 'vitest';

import {
  DIFFICULTY_PLAN,
  LATIN_SIZE,
  MAX_VARIABLE_VALUE,
  QUESTIONS_PER_SECTION,
  SECTION_SPECS,
  TOTAL_TESTS,
} from '@/data/examSpec';
import { mockTests, questionBank, totalQuestionCount } from '@/data/questionBank';
import { BANK_VERSION } from '@/lib/buildBank';
import { solveRenderedSystem, validateBank, validateQuestion } from '@/lib/validateBank';
import { countSolutions, isCompleteLatinSquare, propagate } from '@/lib/latinSquare';
import type { Grid } from '@/lib/latinSquare';
import type { LatinSquaresQuestion, MathEquationsQuestion, Question } from '@/types';

/**
 * These tests are the safety net on the 600 shipped questions: every answer is
 * re-derived here from the question data alone, so a generator bug cannot slip
 * into the bank unnoticed.
 */

const allQuestions = (): Question[] =>
  mockTests.flatMap((test) => test.sections.flatMap((section) => section.questions));

describe('bank shape', () => {
  it('ships the expected schema version and seed', () => {
    expect(questionBank.version).toBe(BANK_VERSION);
    expect(Number.isInteger(questionBank.seed)).toBe(true);
  });

  it('contains ten mock tests', () => {
    expect(mockTests).toHaveLength(TOTAL_TESTS);
    expect(mockTests.map((test) => test.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('contains 600 questions: 10 tests x 3 sections x 20 questions', () => {
    expect(totalQuestionCount).toBe(600);
    expect(allQuestions()).toHaveLength(600);
  });

  it('gives every test the three subtests in exam order', () => {
    for (const test of mockTests) {
      expect(test.sections.map((section) => section.id)).toEqual(
        SECTION_SPECS.map((spec) => spec.id),
      );
      expect(test.sections.map((section) => section.order)).toEqual([1, 2, 3]);
      for (const section of test.sections) {
        expect(section.questions).toHaveLength(QUESTIONS_PER_SECTION);
      }
    }
  });

  it('matches each section to its question type', () => {
    const expected = {
      'figure-sequences': 'figure-sequence',
      'mathematical-equations': 'math-equations',
      'latin-squares': 'latin-squares',
    } as const;

    for (const test of mockTests) {
      for (const section of test.sections) {
        for (const question of section.questions) {
          expect(question.type).toBe(expected[section.id]);
        }
      }
    }
  });

  it('follows the planned low/medium/high ramp in every section', () => {
    for (const test of mockTests) {
      for (const section of test.sections) {
        expect(section.questions.map((question) => question.difficulty)).toEqual(DIFFICULTY_PLAN);
      }
    }
  });

  it('gives every question a unique id and a non-empty explanation', () => {
    const ids = new Set<string>();
    for (const question of allQuestions()) {
      expect(ids.has(question.id)).toBe(false);
      ids.add(question.id);
      expect(question.explanation.length).toBeGreaterThan(0);
      for (const line of question.explanation) {
        expect(line.trim().length).toBeGreaterThan(0);
      }
    }
    expect(ids.size).toBe(600);
  });

  it('produces no distinct questions that are byte-identical', () => {
    const seen = new Map<string, string>();
    let duplicates = 0;
    for (const question of allQuestions()) {
      const { id, ...rest } = question;
      const key = JSON.stringify(rest);
      if (seen.has(key)) duplicates += 1;
      else seen.set(key, id);
    }
    expect(duplicates).toBe(0);
  });
});

describe('full bank validation', () => {
  it('passes the independent validator with no issues', () => {
    const report = validateBank(questionBank);
    expect(report.issues).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.questionCount).toBe(600);
  });

  it('reports no issue for any individual question', () => {
    for (const question of allQuestions()) {
      expect(validateQuestion(question)).toEqual([]);
    }
  });
});

describe('figure sequences', () => {
  const figures = allQuestions().filter((question) => question.type === 'figure-sequence');

  it('shows four matrices and offers three options for each of the two blanks', () => {
    for (const question of figures) {
      expect(question.given).toHaveLength(4);
      expect(question.options).toHaveLength(2);
      for (const optionSet of question.options) {
        expect(optionSet).toHaveLength(3);
      }
      expect(question.answer).toHaveLength(2);
    }
  });

  it('points every answer at a real option', () => {
    for (const question of figures) {
      question.answer.forEach((index, blank) => {
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(question.options[blank]!.length);
      });
    }
  });

  it('keeps every figure inside the 4x4 matrix and never overlapping', () => {
    for (const question of figures) {
      const matrices = [...question.given, ...question.options.flat()];
      for (const matrix of matrices) {
        const cells = new Set<string>();
        for (const figure of matrix.figures) {
          expect(figure.row).toBeGreaterThanOrEqual(0);
          expect(figure.row).toBeLessThan(4);
          expect(figure.col).toBeGreaterThanOrEqual(0);
          expect(figure.col).toBeLessThan(4);
          expect([0, 90, 180, 270]).toContain(figure.rotation);
          const cell = `${figure.row},${figure.col}`;
          expect(cells.has(cell)).toBe(false);
          cells.add(cell);
        }
      }
    }
  });

  it('keeps the figure count constant across the whole series', () => {
    for (const question of figures) {
      const count = question.given[0]!.figures.length;
      for (const matrix of [...question.given, ...question.options.flat()]) {
        expect(matrix.figures.length).toBe(count);
      }
    }
  });

  it('scales the number of figures with the difficulty', () => {
    for (const question of figures) {
      const count = question.given[0]!.figures.length;
      if (question.difficulty === 'low') expect(count).toBe(1);
      if (question.difficulty === 'medium') expect(count).toBeGreaterThanOrEqual(2);
      if (question.difficulty === 'high') expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(4);
    }
  });

  it('explains one rule per figure', () => {
    for (const question of figures) {
      expect(question.explanation).toHaveLength(question.given[0]!.figures.length);
    }
  });
});

describe('mathematical equations', () => {
  const systems = allQuestions().filter(
    (question): question is MathEquationsQuestion => question.type === 'math-equations',
  );

  it('re-solves every system from its rendered text and lands on the stored answer', () => {
    for (const question of systems) {
      const solutions = solveRenderedSystem(question.variables, question.equations, 2);
      expect(solutions).toHaveLength(1);
      expect(solutions[0]).toEqual(question.answer);
    }
  });

  it('keeps every unknown in the range 1..20', () => {
    for (const question of systems) {
      for (const name of question.variables) {
        const value = question.answer[name]!;
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(MAX_VARIABLE_VALUE);
      }
    }
  });

  it('scales the number of unknowns with the difficulty', () => {
    for (const question of systems) {
      const expected = question.difficulty === 'low' ? 2 : question.difficulty === 'medium' ? 3 : 4;
      expect(question.variables).toHaveLength(expected);
      expect(question.equations).toHaveLength(expected);
    }
  });

  it('never gives a medium or high system away with a single-unknown equation', () => {
    for (const question of systems) {
      if (question.difficulty === 'low') continue;
      for (const equation of question.equations) {
        const used = question.variables.filter((name) => equation.includes(name));
        // Every equation must connect at least two unknowns.
        expect(used.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('latin squares', () => {
  const squares = allQuestions().filter(
    (question): question is LatinSquaresQuestion => question.type === 'latin-squares',
  );

  it('uses a 5x5 grid with the five letters as response options', () => {
    for (const question of squares) {
      expect(question.grid).toHaveLength(LATIN_SIZE);
      for (const row of question.grid) expect(row).toHaveLength(LATIN_SIZE);
      expect(question.options).toEqual(['A', 'B', 'C', 'D', 'E']);
      expect(question.options).toContain(question.answer);
    }
  });

  it('stores a valid completed square that agrees with every clue', () => {
    for (const question of squares) {
      expect(isCompleteLatinSquare(question.solution as Grid)).toBe(true);
      for (let row = 0; row < LATIN_SIZE; row += 1) {
        for (let col = 0; col < LATIN_SIZE; col += 1) {
          const clue = question.grid[row]![col];
          if (clue) expect(clue).toBe(question.solution[row]![col]);
        }
      }
    }
  });

  it('leaves the question-mark field empty and derivable', () => {
    for (const question of squares) {
      const { row, col } = question.target;
      expect(question.grid[row]![col]).toBeNull();

      const { grid, contradiction } = propagate(question.grid as Grid, question.target);
      expect(contradiction).toBe(false);
      expect(grid[row]![col]).toBe(question.answer);
    }
  });

  it('has exactly one completion, so exactly one letter fits', () => {
    for (const question of squares) {
      expect(countSolutions(question.grid as Grid, 2)).toBe(1);
    }
  });

  it('gets harder by leaving fewer clues and needing a longer deduction chain', () => {
    const clueCount = (question: LatinSquaresQuestion) =>
      question.grid.flat().filter((cell) => cell !== null).length;

    for (const question of squares) {
      const clues = clueCount(question);
      const steps = question.explanation.length;
      if (question.difficulty === 'low') {
        expect(clues).toBeGreaterThanOrEqual(15);
        expect(steps).toBeLessThanOrEqual(4);
      }
      if (question.difficulty === 'medium') {
        expect(clues).toBeLessThanOrEqual(12);
        expect(steps).toBeGreaterThanOrEqual(3);
        expect(steps).toBeLessThanOrEqual(8);
      }
      if (question.difficulty === 'high') {
        expect(clues).toBeLessThanOrEqual(10);
        expect(steps).toBeGreaterThanOrEqual(6);
        expect(steps).toBeLessThanOrEqual(13);
      }
    }
  });
});

describe('validator rejects broken questions', () => {
  it('catches a Latin square whose stored answer is wrong', () => {
    const original = mockTests[0]!.sections[2]!.questions[0] as LatinSquaresQuestion;
    const wrongLetter = original.options.find((letter) => letter !== original.answer)!;
    const broken: LatinSquaresQuestion = { ...original, answer: wrongLetter };

    const issues = validateQuestion(broken);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((issue) => issue.message.includes('forces'))).toBe(true);
  });

  it('catches an equation system whose stored answer does not solve it', () => {
    const original = mockTests[0]!.sections[1]!.questions[0] as MathEquationsQuestion;
    const name = original.variables[0]!;
    const broken: MathEquationsQuestion = {
      ...original,
      answer: { ...original.answer, [name]: (original.answer[name]! % 20) + 1 },
    };

    const issues = validateQuestion(broken);
    expect(issues.some((issue) => issue.message.includes('stored answer'))).toBe(true);
  });

  it('catches a figure sequence whose answer index is out of range', () => {
    const original = mockTests[0]!.sections[0]!.questions[0];
    if (original.type !== 'figure-sequence') throw new Error('unexpected question type');
    const broken = { ...original, answer: [5, 0] as [number, number] };

    const issues = validateQuestion(broken);
    expect(issues.some((issue) => issue.message.includes('out-of-range'))).toBe(true);
  });
});

describe('rendered equation parser', () => {
  it('understands the operators used by the bank', () => {
    expect(solveRenderedSystem(['A'], ['3 × A = 12'])).toEqual([{ A: 4 }]);
    expect(solveRenderedSystem(['A'], ['A ÷ 2 = 6'])).toEqual([{ A: 12 }]);
    expect(solveRenderedSystem(['A', 'B'], ['A + B = 5', 'A - B = 1'])).toEqual([{ A: 3, B: 2 }]);
    expect(
      solveRenderedSystem(['A', 'B', 'C'], ['A - B + C = 9', '2 × B = A', 'C = 3']),
    ).toEqual([{ A: 12, B: 6, C: 3 }]);
  });

  it('returns nothing for an unparseable equation', () => {
    expect(solveRenderedSystem(['A'], ['A ^ 2 = 4'])).toEqual([]);
  });
});
