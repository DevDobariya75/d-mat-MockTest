import { LATIN_SIZE } from '@/data/examSpec';
import type { Difficulty, LatinLetter, LatinSquaresQuestion } from '@/types';
import type { Rng } from '@/lib/rng';

/**
 * Engine for the "Latin Squares" subtest.
 *
 * A 5x5 grid holds the letters A-E, each exactly once per row and per column.
 * One field carries the red question mark; the test taker picks the letter that
 * belongs there. Puzzles are generated so that
 *
 *  1. the grid has exactly one valid completion, and
 *  2. the question-mark field can be derived by plain constraint propagation,
 *     which yields the step-by-step solution path shown after the test.
 *
 * Coordinates follow the notation of the official solution key: columns are
 * named with the Greek letters alpha..epsilon, rows are numbered 1..5.
 */

export const LETTERS: LatinLetter[] = ['A', 'B', 'C', 'D', 'E'];
export const COLUMN_NAMES = ['α', 'β', 'γ', 'δ', 'ε'];

export type Grid = (LatinLetter | null)[][];

export const cellName = (row: number, col: number): string =>
  `${COLUMN_NAMES[col] ?? '?'}${row + 1}`;

export const cloneGrid = (grid: Grid): Grid => grid.map((row) => [...row]);

/* ------------------------------------------------------------------ *
 * Validity
 * ------------------------------------------------------------------ */

/** Checks that no letter repeats in any row or column. Empty fields are ignored. */
export function isConsistent(grid: Grid): boolean {
  for (let i = 0; i < LATIN_SIZE; i += 1) {
    const rowSeen = new Set<LatinLetter>();
    const colSeen = new Set<LatinLetter>();
    for (let j = 0; j < LATIN_SIZE; j += 1) {
      const rowValue = grid[i]![j];
      if (rowValue) {
        if (rowSeen.has(rowValue)) return false;
        rowSeen.add(rowValue);
      }
      const colValue = grid[j]![i];
      if (colValue) {
        if (colSeen.has(colValue)) return false;
        colSeen.add(colValue);
      }
    }
  }
  return true;
}

/** True when the grid is completely filled and every row and column is a permutation. */
export function isCompleteLatinSquare(grid: Grid): boolean {
  for (const row of grid) {
    if (row.some((cell) => cell === null)) return false;
  }
  return isConsistent(grid);
}

/* ------------------------------------------------------------------ *
 * Candidates and propagation
 * ------------------------------------------------------------------ */

export function candidatesFor(grid: Grid, row: number, col: number): LatinLetter[] {
  if (grid[row]![col]) return [grid[row]![col]!];
  const used = new Set<LatinLetter>();
  for (let k = 0; k < LATIN_SIZE; k += 1) {
    const inRow = grid[row]![k];
    const inCol = grid[k]![col];
    if (inRow) used.add(inRow);
    if (inCol) used.add(inCol);
  }
  return LETTERS.filter((letter) => !used.has(letter));
}

export interface PropagationStep {
  row: number;
  col: number;
  letter: LatinLetter;
  reason: string;
}

export interface PropagationResult {
  grid: Grid;
  steps: PropagationStep[];
  /** True when the propagation ran into a contradiction. */
  contradiction: boolean;
}

/**
 * Repeatedly fills fields that are forced, using only the three deductions a
 * human applies on paper:
 *
 *  - "naked single": a field has exactly one remaining candidate,
 *  - "hidden single (row)": a letter fits only one field of a row,
 *  - "hidden single (column)": a letter fits only one field of a column.
 *
 * Stops as soon as `stopAt` is filled, so the recorded solution path is as
 * short as the one in the official key.
 */
export function propagate(
  input: Grid,
  stopAt?: { row: number; col: number },
): PropagationResult {
  const grid = cloneGrid(input);
  const steps: PropagationStep[] = [];

  const isDone = () =>
    stopAt !== undefined && grid[stopAt.row]![stopAt.col] !== null;

  while (!isDone()) {
    let progressed = false;

    // Naked singles.
    for (let row = 0; row < LATIN_SIZE && !progressed; row += 1) {
      for (let col = 0; col < LATIN_SIZE && !progressed; col += 1) {
        if (grid[row]![col]) continue;
        const candidates = candidatesFor(grid, row, col);
        if (candidates.length === 0) return { grid, steps, contradiction: true };
        if (candidates.length === 1) {
          const letter = candidates[0]!;
          grid[row]![col] = letter;
          steps.push({
            row,
            col,
            letter,
            reason: `Only ${letter} can be inserted at position ${cellName(row, col)}, as all other letters already appear in its row or column.`,
          });
          progressed = true;
        }
      }
    }

    // Hidden singles in a row.
    for (let row = 0; row < LATIN_SIZE && !progressed; row += 1) {
      for (const letter of LETTERS) {
        if (grid[row]!.includes(letter)) continue;
        const fits: number[] = [];
        for (let col = 0; col < LATIN_SIZE; col += 1) {
          if (grid[row]![col]) continue;
          if (candidatesFor(grid, row, col).includes(letter)) fits.push(col);
        }
        if (fits.length === 0) return { grid, steps, contradiction: true };
        if (fits.length === 1) {
          const col = fits[0]!;
          grid[row]![col] = letter;
          steps.push({
            row,
            col,
            letter,
            reason: `In row ${row + 1}, ${letter} fits only at position ${cellName(row, col)}.`,
          });
          progressed = true;
          break;
        }
      }
    }

    // Hidden singles in a column.
    for (let col = 0; col < LATIN_SIZE && !progressed; col += 1) {
      for (const letter of LETTERS) {
        const column = Array.from({ length: LATIN_SIZE }, (_, row) => grid[row]![col]);
        if (column.includes(letter)) continue;
        const fits: number[] = [];
        for (let row = 0; row < LATIN_SIZE; row += 1) {
          if (grid[row]![col]) continue;
          if (candidatesFor(grid, row, col).includes(letter)) fits.push(row);
        }
        if (fits.length === 0) return { grid, steps, contradiction: true };
        if (fits.length === 1) {
          const row = fits[0]!;
          grid[row]![col] = letter;
          steps.push({
            row,
            col,
            letter,
            reason: `In column ${COLUMN_NAMES[col]}, ${letter} fits only at position ${cellName(row, col)}.`,
          });
          progressed = true;
          break;
        }
      }
    }

    if (!progressed) break;
  }

  return { grid, steps, contradiction: false };
}

/* ------------------------------------------------------------------ *
 * Exhaustive solver, used to prove uniqueness
 * ------------------------------------------------------------------ */

/** Counts completions of `grid`, stopping once `limit` have been found. */
export function countSolutions(grid: Grid, limit = 2): number {
  const work = cloneGrid(grid);
  let found = 0;

  const search = (): void => {
    if (found >= limit) return;

    // Pick the most constrained empty field first.
    let best: { row: number; col: number; candidates: LatinLetter[] } | null = null;
    for (let row = 0; row < LATIN_SIZE; row += 1) {
      for (let col = 0; col < LATIN_SIZE; col += 1) {
        if (work[row]![col]) continue;
        const candidates = candidatesFor(work, row, col);
        if (candidates.length === 0) return;
        if (!best || candidates.length < best.candidates.length) {
          best = { row, col, candidates };
        }
      }
    }

    if (!best) {
      found += 1;
      return;
    }

    for (const letter of best.candidates) {
      work[best.row]![best.col] = letter;
      search();
      work[best.row]![best.col] = null;
      if (found >= limit) return;
    }
  };

  search();
  return found;
}

/* ------------------------------------------------------------------ *
 * Generation
 * ------------------------------------------------------------------ */

/** Builds a random complete 5x5 Latin square. */
export function randomLatinSquare(rng: Rng): LatinLetter[][] {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const grid: Grid = Array.from({ length: LATIN_SIZE }, () =>
      Array.from({ length: LATIN_SIZE }, () => null),
    );

    const fill = (index: number): boolean => {
      if (index === LATIN_SIZE * LATIN_SIZE) return true;
      const row = Math.floor(index / LATIN_SIZE);
      const col = index % LATIN_SIZE;
      for (const letter of rng.shuffle(candidatesFor(grid, row, col))) {
        grid[row]![col] = letter;
        if (fill(index + 1)) return true;
        grid[row]![col] = null;
      }
      return false;
    };

    if (fill(0)) return grid as LatinLetter[][];
  }
  throw new Error('Unable to build a Latin square');
}

/** Number of clues left on the grid, by difficulty. */
const CLUE_TARGET: Record<Difficulty, number> = {
  low: 15,
  medium: 12,
  high: 10,
};

/**
 * Length of the deduction chain that leads to the question mark. The official
 * solution keys run from a single step (low) to roughly seven steps (high), so
 * the bounds keep every task solvable in the ~75 s a test taker has per task.
 */
const STEP_RANGE: Record<Difficulty, { min: number; max: number }> = {
  low: { min: 1, max: 4 },
  medium: { min: 3, max: 8 },
  high: { min: 6, max: 13 },
};

export function generateLatinSquaresQuestion(
  id: string,
  difficulty: Difficulty,
  rng: Rng,
): LatinSquaresQuestion {
  const clueTarget = CLUE_TARGET[difficulty];
  const { min: minSteps, max: maxSteps } = STEP_RANGE[difficulty];

  for (let attempt = 0; attempt < 400; attempt += 1) {
    const solution = randomLatinSquare(rng);
    const target = { row: rng.int(0, LATIN_SIZE - 1), col: rng.int(0, LATIN_SIZE - 1) };

    // Start from the full square and remove clues one by one, keeping the
    // completion unique at every step.
    const puzzle: Grid = cloneGrid(solution);
    puzzle[target.row]![target.col] = null;

    const removable = rng
      .shuffle(
        Array.from({ length: LATIN_SIZE * LATIN_SIZE }, (_, i) => ({
          row: Math.floor(i / LATIN_SIZE),
          col: i % LATIN_SIZE,
        })),
      )
      .filter((cell) => !(cell.row === target.row && cell.col === target.col));

    let clues = LATIN_SIZE * LATIN_SIZE - 1;
    for (const cell of removable) {
      if (clues <= clueTarget) break;
      const backup = puzzle[cell.row]![cell.col];
      puzzle[cell.row]![cell.col] = null;
      if (countSolutions(puzzle, 2) === 1) {
        clues -= 1;
      } else {
        puzzle[cell.row]![cell.col] = backup;
      }
    }

    if (clues > clueTarget) continue;

    // The question-mark field must be reachable by plain propagation, otherwise
    // the task would require guessing.
    const { grid: propagated, steps, contradiction } = propagate(puzzle, target);
    if (contradiction) continue;
    const derived = propagated[target.row]![target.col];
    if (!derived) continue;
    if (derived !== solution[target.row]![target.col]) continue;
    if (steps.length < minSteps || steps.length > maxSteps) continue;

    const explanation = steps.map((step) =>
      step.row === target.row && step.col === target.col
        ? `At the position of the question mark, ${step.letter} must be inserted, since all other letters already appear in its row or column.`
        : step.reason,
    );

    return {
      id,
      type: 'latin-squares',
      difficulty,
      grid: puzzle,
      target,
      options: [...LETTERS],
      answer: derived,
      solution,
      explanation,
    };
  }

  throw new Error(`Unable to generate a Latin square for ${id} (${difficulty})`);
}
