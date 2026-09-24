import { describe, expect, it } from 'vitest';

import { GRID_SIZE } from '@/data/examSpec';
import {
  borderRing,
  buildSequence,
  centerRing,
  generateFigureSequenceQuestion,
  matrixKey,
  simulateFigure,
  simulatePositions,
  type FigureRule,
} from '@/lib/figureSequence';
import { generateMathEquationsQuestion, solveSystem, VARIABLE_NAMES } from '@/lib/equations';
import {
  candidatesFor,
  countSolutions,
  generateLatinSquaresQuestion,
  isCompleteLatinSquare,
  isConsistent,
  LETTERS,
  propagate,
  randomLatinSquare,
} from '@/lib/latinSquare';
import type { Grid } from '@/lib/latinSquare';
import { createRng, hashSeed } from '@/lib/rng';
import { buildSection } from '@/lib/buildBank';
import { validateQuestion } from '@/lib/validateBank';

const rule = (overrides: Partial<FigureRule>): FigureRule => ({
  shape: 'square',
  start: { row: 0, col: 0 },
  motion: { kind: 'static' },
  rotationStep: 0,
  rotationAccelerates: false,
  startRotation: 0,
  colorCycle: ['blue'],
  ...overrides,
});

describe('seeded rng', () => {
  it('produces the same stream for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const first = Array.from({ length: 20 }, () => a.int(0, 999));
    const second = Array.from({ length: 20 }, () => b.int(0, 999));
    expect(first).toEqual(second);
  });

  it('produces a different stream for a different seed', () => {
    const a = Array.from({ length: 20 }, (_, i) => createRng(1).int(0, 999) + i * 0);
    const b = Array.from({ length: 20 }, (_, i) => createRng(2).int(0, 999) + i * 0);
    expect(a[0]).not.toBe(b[0]);
  });

  it('stays inside the requested range', () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i += 1) {
      const value = rng.int(3, 9);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(9);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('shuffles without losing or duplicating items', () => {
    const rng = createRng(99);
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = rng.shuffle(input);
    expect([...shuffled].sort((x, y) => x - y)).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]); // not mutated
  });

  it('hashes deterministically', () => {
    expect(hashSeed('a', 1)).toBe(hashSeed('a', 1));
    expect(hashSeed('a', 1)).not.toBe(hashSeed('a', 2));
  });
});

describe('figure movement rules', () => {
  it('lists the outer ring clockwise and the four middle fields', () => {
    const ring = borderRing();
    expect(ring).toHaveLength(4 * GRID_SIZE - 4);
    expect(ring[0]).toEqual({ row: 0, col: 0 });
    expect(ring[GRID_SIZE - 1]).toEqual({ row: 0, col: GRID_SIZE - 1 });
    expect(centerRing()).toEqual([
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 2, col: 2 },
      { row: 2, col: 1 },
    ]);
  });

  it('circles the four middle fields, as in the official example task', () => {
    // The example in the preparatory materials: a square moving clockwise
    // through the centre, starting bottom-left of the 2x2 centre.
    const positions = simulatePositions(
      rule({ start: { row: 2, col: 1 }, motion: { kind: 'center', direction: 1 } }),
    );
    expect(positions).toEqual([
      { row: 2, col: 1 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 2, col: 2 },
      { row: 2, col: 1 },
      { row: 1, col: 1 },
    ]);
  });

  it('bounces off the upper and lower border when moving vertically', () => {
    const positions = simulatePositions(
      rule({
        start: { row: 1, col: 1 },
        motion: { kind: 'line', axis: 'vertical', step: 1, direction: -1, accelerate: false },
      }),
    );
    expect(positions).toEqual([
      { row: 1, col: 1 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 2, col: 1 },
      { row: 3, col: 1 },
      { row: 2, col: 1 },
    ]);
  });

  it('retraces its path when a diagonal hits a boundary', () => {
    const positions = simulatePositions(
      rule({
        start: { row: 2, col: 0 },
        motion: { kind: 'diagonal', dr: -1, dc: 1, step: 1, accelerate: false },
      }),
    );
    expect(positions).toEqual([
      { row: 2, col: 0 },
      { row: 1, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 1 },
      { row: 2, col: 0 },
      { row: 1, col: 1 },
    ]);
  });

  it('moves along the outer border by x + 1 fields', () => {
    const ring = borderRing();
    const positions = simulatePositions(
      rule({
        start: { row: 0, col: 0 },
        motion: { kind: 'border', direction: 1, step: 1, accelerate: true },
      }),
    )!;
    // Cumulative steps 0, 1, 3, 6, 10, 15 around a ring of 12.
    expect(positions).toEqual([0, 1, 3, 6, 10, 3].map((index) => ring[index]!));
  });

  it('repeats a cycle of directions', () => {
    const positions = simulatePositions(
      rule({
        start: { row: 2, col: 2 },
        motion: { kind: 'directions', order: ['left', 'up', 'right', 'down'] },
      }),
    );
    expect(positions).toEqual([
      { row: 2, col: 2 },
      { row: 2, col: 1 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 2, col: 2 },
      { row: 2, col: 1 },
    ]);
  });

  it('rejects a rule that would leave the matrix', () => {
    expect(
      simulatePositions(
        rule({
          start: { row: 0, col: 0 },
          motion: { kind: 'directions', order: ['up', 'up', 'up', 'up'] },
        }),
      ),
    ).toBeNull();
  });

  it('rejects a border rule that does not start on the border', () => {
    expect(
      simulatePositions(
        rule({
          start: { row: 1, col: 1 },
          motion: { kind: 'border', direction: 1, step: 1, accelerate: false },
        }),
      ),
    ).toBeNull();
  });

  it('rotates by 90 degrees per image and wraps around', () => {
    const track = simulateFigure(
      rule({ shape: 'triangle', rotationStep: 1, startRotation: 270 }),
    )!;
    expect(track.map((figure) => figure.rotation)).toEqual([270, 0, 90, 180, 270, 0]);
  });

  it('turns x + 1 times by 90 degrees when the rotation accelerates', () => {
    const track = simulateFigure(
      rule({ shape: 'arrow', rotationStep: 1, rotationAccelerates: true, startRotation: 0 }),
    )!;
    // Cumulative quarter turns 0, 1, 3, 6, 10, 15 -> mod 4.
    expect(track.map((figure) => figure.rotation)).toEqual([0, 90, 270, 180, 180, 270]);
  });

  it('cycles the colours one per image', () => {
    const track = simulateFigure(rule({ colorCycle: ['yellow', 'green', 'orange'] }))!;
    expect(track.map((figure) => figure.color)).toEqual([
      'yellow',
      'green',
      'orange',
      'yellow',
      'green',
      'orange',
    ]);
  });

  it('refuses a series in which two figures would overlap', () => {
    const overlapping = buildSequence([
      rule({ shape: 'square', start: { row: 0, col: 0 } }),
      rule({ shape: 'diamond', start: { row: 0, col: 0 } }),
    ]);
    expect(overlapping).toBeNull();
  });

  it('builds six matrices for a valid rule set', () => {
    const matrices = buildSequence([
      rule({ shape: 'square', start: { row: 1, col: 1 }, motion: { kind: 'center', direction: 1 } }),
      rule({
        shape: 'diamond',
        start: { row: 0, col: 0 },
        motion: { kind: 'border', direction: 1, step: 1, accelerate: false },
      }),
    ]);
    expect(matrices).toHaveLength(6);
    expect(new Set(matrices!.map(matrixKey)).size).toBeGreaterThan(1);
  });
});

describe('figure sequence generation', () => {
  it('generates valid questions across many seeds', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      for (const difficulty of ['low', 'medium', 'high'] as const) {
        const question = generateFigureSequenceQuestion(
          `probe-${difficulty}-${seed}`,
          difficulty,
          createRng(hashSeed('figures', difficulty, seed)),
        );
        expect(validateQuestion(question)).toEqual([]);
        expect(question.difficulty).toBe(difficulty);
      }
    }
  });
});

describe('equation solving', () => {
  it('finds the single solution of a linear system over 1..20', () => {
    const solutions = solveSystem(
      ['A', 'B'],
      [
        { coeffs: { A: 1, B: -1 }, constant: 3, display: 'A + 3 = B' },
        { coeffs: { A: 1, B: 1 }, constant: -13, display: 'A + B = 13' },
      ],
      2,
    );
    expect(solutions).toEqual([{ A: 5, B: 8 }]);
  });

  it('reports an under-determined system as having several solutions', () => {
    const solutions = solveSystem(
      ['A', 'B'],
      [{ coeffs: { A: 1, B: -1 }, constant: 0, display: 'A = B' }],
      2,
    );
    expect(solutions).toHaveLength(2);
  });

  it('generates uniquely solvable systems across many seeds', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      for (const difficulty of ['low', 'medium', 'high'] as const) {
        const question = generateMathEquationsQuestion(
          `probe-${difficulty}-${seed}`,
          difficulty,
          createRng(hashSeed('equations', difficulty, seed)),
        );
        expect(validateQuestion(question)).toEqual([]);
        expect(question.variables.every((name) => VARIABLE_NAMES.includes(name))).toBe(true);
      }
    }
  });
});

describe('latin square engine', () => {
  it('builds complete, valid squares', () => {
    for (let seed = 0; seed < 25; seed += 1) {
      const square = randomLatinSquare(createRng(seed));
      expect(isCompleteLatinSquare(square as Grid)).toBe(true);
    }
  });

  it('detects a repeated letter in a row or a column', () => {
    const grid: Grid = [
      ['A', 'A', null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ];
    expect(isConsistent(grid)).toBe(false);

    const columnClash: Grid = [
      ['A', null, null, null, null],
      ['A', null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ];
    expect(isConsistent(columnClash)).toBe(false);
  });

  it('computes the candidates of a field from its row and column', () => {
    const grid: Grid = [
      ['A', 'B', null, null, null],
      ['C', null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ];
    expect(candidatesFor(grid, 1, 1)).toEqual(['A', 'D', 'E']);
  });

  it('counts completions and stops at the limit', () => {
    const almost: Grid = [
      ['A', 'B', 'C', 'D', 'E'],
      ['B', 'C', 'D', 'E', 'A'],
      ['C', 'D', 'E', 'A', 'B'],
      ['D', 'E', 'A', 'B', 'C'],
      ['E', 'A', 'B', 'C', null],
    ];
    expect(countSolutions(almost, 2)).toBe(1);

    const wideOpen: Grid = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => null));
    expect(countSolutions(wideOpen, 2)).toBe(2);
  });

  it('solves the worked example from the official solution key', () => {
    // Exercise 1 of the preparatory materials: the question mark sits at the
    // top of column beta and must become C.
    const grid: Grid = [
      ['B', null, 'A', 'D', null],
      ['A', 'B', 'E', 'C', null],
      [null, 'A', null, null, null],
      ['C', null, null, null, null],
      ['D', 'E', null, 'B', null],
    ];
    const { grid: solved, contradiction } = propagate(grid, { row: 0, col: 1 });
    expect(contradiction).toBe(false);
    expect(solved[0]![1]).toBe('C');
  });

  it('records a human-readable deduction for every filled field', () => {
    const grid: Grid = [
      ['B', null, 'A', 'D', null],
      ['A', 'B', 'E', 'C', null],
      [null, 'A', null, null, null],
      ['C', null, null, null, null],
      ['D', 'E', null, 'B', null],
    ];
    const { steps } = propagate(grid, { row: 0, col: 1 });
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(LETTERS).toContain(step.letter);
      expect(step.reason.length).toBeGreaterThan(10);
    }
  });

  it('generates solvable puzzles across many seeds', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      for (const difficulty of ['low', 'medium', 'high'] as const) {
        const question = generateLatinSquaresQuestion(
          `probe-${difficulty}-${seed}`,
          difficulty,
          createRng(hashSeed('latin', difficulty, seed)),
        );
        expect(validateQuestion(question)).toEqual([]);
      }
    }
  });
});

describe('bank building is reproducible', () => {
  it('produces identical sections for the same seed', () => {
    const first = buildSection(1, 'latin-squares', 12345);
    const second = buildSection(1, 'latin-squares', 12345);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('produces different sections for different tests', () => {
    const one = buildSection(1, 'latin-squares', 12345);
    const two = buildSection(2, 'latin-squares', 12345);
    expect(JSON.stringify(one.questions)).not.toBe(JSON.stringify(two.questions));
  });
});
