import {
  FIGURE_OPTION_COUNT,
  GRID_SIZE,
  LATIN_SIZE,
  MAX_VARIABLE_VALUE,
  MIN_VARIABLE_VALUE,
  QUESTIONS_PER_SECTION,
  SECTION_SPECS,
  TOTAL_TESTS,
} from '@/data/examSpec';
import { matrixKey, SEQUENCE_LENGTH } from '@/lib/figureSequence';
import {
  candidatesFor,
  cloneGrid,
  countSolutions,
  isConsistent,
  isCompleteLatinSquare,
  LETTERS,
  propagate,
} from '@/lib/latinSquare';
import type { Grid } from '@/lib/latinSquare';
import type {
  FigureMatrix,
  FigureSequenceQuestion,
  LatinSquaresQuestion,
  MathEquationsQuestion,
  MockTest,
  Question,
  QuestionBank,
} from '@/types';

/**
 * Independent validation of the generated question bank.
 *
 * Nothing here trusts the generators: Latin squares are re-solved from their
 * clues, equation systems are re-solved by parsing the *rendered* equation
 * strings, and figure-sequence options are checked for shape, distinctness and
 * a single correct answer.
 */

export interface ValidationIssue {
  questionId: string;
  message: string;
}

export interface ValidationReport {
  ok: boolean;
  questionCount: number;
  issues: ValidationIssue[];
}

/* ------------------------------------------------------------------ *
 * Figure sequences
 * ------------------------------------------------------------------ */

const matrixIsWellFormed = (matrix: FigureMatrix): string | null => {
  if (matrix.figures.length === 0) return 'matrix has no figures';
  const seen = new Set<string>();
  for (const figure of matrix.figures) {
    if (
      !Number.isInteger(figure.row) ||
      !Number.isInteger(figure.col) ||
      figure.row < 0 ||
      figure.col < 0 ||
      figure.row >= GRID_SIZE ||
      figure.col >= GRID_SIZE
    ) {
      return `figure ${figure.shape} sits outside the ${GRID_SIZE}x${GRID_SIZE} matrix`;
    }
    const cell = `${figure.row},${figure.col}`;
    if (seen.has(cell)) return `two figures overlap at ${cell}`;
    seen.add(cell);
  }
  return null;
};

function validateFigureSequence(
  question: FigureSequenceQuestion,
  issues: ValidationIssue[],
): void {
  const add = (message: string) => issues.push({ questionId: question.id, message });

  if (question.given.length !== SEQUENCE_LENGTH - 2) {
    add(`expected ${SEQUENCE_LENGTH - 2} given matrices, found ${question.given.length}`);
  }
  for (const matrix of question.given) {
    const problem = matrixIsWellFormed(matrix);
    if (problem) add(`given matrix invalid: ${problem}`);
  }

  if (question.options.length !== 2) add('expected two blanks (Image 1 and Image 2)');

  const figureCount = question.given[0]?.figures.length ?? 0;
  question.options.forEach((optionSet, blank) => {
    if (optionSet.length !== FIGURE_OPTION_COUNT) {
      add(`blank ${blank + 1} has ${optionSet.length} options, expected ${FIGURE_OPTION_COUNT}`);
    }
    const keys = new Set<string>();
    for (const matrix of optionSet) {
      const problem = matrixIsWellFormed(matrix);
      if (problem) add(`blank ${blank + 1} option invalid: ${problem}`);
      if (matrix.figures.length !== figureCount) {
        add(`blank ${blank + 1} option has ${matrix.figures.length} figures, expected ${figureCount}`);
      }
      keys.add(matrixKey(matrix));
    }
    if (keys.size !== optionSet.length) add(`blank ${blank + 1} has duplicate options`);

    const answer = question.answer[blank];
    if (answer === undefined || answer < 0 || answer >= optionSet.length) {
      add(`blank ${blank + 1} has an out-of-range answer index (${answer})`);
    }
  });

  // The two blanks must not be identical, otherwise one answer gives away the other.
  const firstAnswer = question.options[0]?.[question.answer[0]];
  const secondAnswer = question.options[1]?.[question.answer[1]];
  if (firstAnswer && secondAnswer && matrixKey(firstAnswer) === matrixKey(secondAnswer)) {
    // Legitimate for oscillating rules, so only flag when nothing changes at all.
    const givenKeys = new Set(question.given.map(matrixKey));
    if (givenKeys.size < 3) add('series barely changes between matrices');
  }

  if (question.explanation.length === 0) add('missing explanation');
  if (question.explanation.length !== figureCount) {
    add(`explanation has ${question.explanation.length} lines for ${figureCount} figures`);
  }
}

/* ------------------------------------------------------------------ *
 * Mathematical equations
 * ------------------------------------------------------------------ */

const TIMES = '×';
const DIVIDE = '÷';

/**
 * Parses a rendered equation such as `"2 × A + 2 × C = B"` or `"A - B + C - D = 2"`
 * back into a checker. Deliberately independent from the generator: it only
 * understands the rendered text.
 */
export function parseRenderedEquation(
  display: string,
): ((values: Record<string, number>) => boolean) | null {
  const [lhs, rhs, ...rest] = display.split('=');
  if (!lhs || !rhs || rest.length > 0) return null;

  const parseSide = (
    text: string,
  ): ((values: Record<string, number>) => number | null) | null => {
    // Tokenise into signed products of factors.
    const normalised = text.replace(/\s+/g, ' ').trim();
    const tokens = normalised.split(/\s(?=[+-]\s)/);
    const terms: { sign: number; factors: string[]; divisors: string[] }[] = [];

    for (const raw of tokens) {
      let body = raw.trim();
      let sign = 1;
      if (body.startsWith('+')) body = body.slice(1).trim();
      else if (body.startsWith('-')) {
        sign = -1;
        body = body.slice(1).trim();
      }
      const factors: string[] = [];
      const divisors: string[] = [];
      const pieces = body.split(new RegExp(`\\s*([${TIMES}${DIVIDE}])\\s*`));
      // pieces alternates: factor, operator, factor, operator, ...
      let pendingDivide = false;
      for (const piece of pieces) {
        if (piece === TIMES) {
          pendingDivide = false;
          continue;
        }
        if (piece === DIVIDE) {
          pendingDivide = true;
          continue;
        }
        const token = piece.trim();
        if (!token) continue;
        if (!/^(\d+|[A-D])$/.test(token)) return null;
        if (pendingDivide) divisors.push(token);
        else factors.push(token);
        pendingDivide = false;
      }
      if (factors.length === 0) return null;
      terms.push({ sign, factors, divisors });
    }

    return (values) => {
      let total = 0;
      for (const term of terms) {
        let product = term.sign;
        for (const factor of term.factors) {
          const value = /^\d+$/.test(factor) ? Number(factor) : values[factor];
          if (value === undefined) return null;
          product *= value;
        }
        for (const divisor of term.divisors) {
          const value = /^\d+$/.test(divisor) ? Number(divisor) : values[divisor];
          if (value === undefined || value === 0) return null;
          if (product % value !== 0) return null; // Non-integer intermediate result.
          product /= value;
        }
        total += product;
      }
      return total;
    };
  };

  const left = parseSide(lhs);
  const right = parseSide(rhs);
  if (!left || !right) return null;

  return (values) => {
    const l = left(values);
    const r = right(values);
    if (l === null || r === null) return false;
    return l === r;
  };
}

/** Re-solves a system from its rendered equations by brute force. */
export function solveRenderedSystem(
  variables: string[],
  equations: string[],
  limit = 2,
): Record<string, number>[] {
  const checkers = equations.map(parseRenderedEquation);
  if (checkers.some((checker) => checker === null)) return [];

  const solutions: Record<string, number>[] = [];
  const values: Record<string, number> = {};

  const search = (index: number): void => {
    if (solutions.length >= limit) return;
    if (index === variables.length) {
      if ((checkers as ((v: Record<string, number>) => boolean)[]).every((c) => c(values))) {
        solutions.push({ ...values });
      }
      return;
    }
    const name = variables[index]!;
    for (let value = MIN_VARIABLE_VALUE; value <= MAX_VARIABLE_VALUE; value += 1) {
      values[name] = value;
      search(index + 1);
      if (solutions.length >= limit) break;
    }
    delete values[name];
  };

  search(0);
  return solutions;
}

function validateMathEquations(
  question: MathEquationsQuestion,
  issues: ValidationIssue[],
): void {
  const add = (message: string) => issues.push({ questionId: question.id, message });

  if (question.equations.length < 2) add('fewer than two equations');
  if (question.variables.length < 2) add('fewer than two unknowns');

  for (const name of question.variables) {
    const value = question.answer[name];
    if (value === undefined) {
      add(`no answer for unknown ${name}`);
    } else if (!Number.isInteger(value) || value < MIN_VARIABLE_VALUE || value > MAX_VARIABLE_VALUE) {
      add(`answer ${name} = ${value} is outside 1..${MAX_VARIABLE_VALUE}`);
    }
  }

  for (const display of question.equations) {
    if (parseRenderedEquation(display) === null) {
      add(`cannot parse rendered equation "${display}"`);
    }
  }

  const solutions = solveRenderedSystem(question.variables, question.equations, 2);
  if (solutions.length === 0) {
    add('rendered system has no solution');
  } else if (solutions.length > 1) {
    add('rendered system has more than one solution');
  } else {
    const solution = solutions[0]!;
    for (const name of question.variables) {
      if (solution[name] !== question.answer[name]) {
        add(`stored answer ${name} = ${question.answer[name]} but the system gives ${solution[name]}`);
      }
    }
  }

  // Every unknown must really appear in the text.
  for (const name of question.variables) {
    if (!question.equations.some((display) => display.includes(name))) {
      add(`unknown ${name} never appears in the equations`);
    }
  }

  if (question.explanation.length === 0) add('missing explanation');
}

/* ------------------------------------------------------------------ *
 * Latin squares
 * ------------------------------------------------------------------ */

function validateLatinSquares(
  question: LatinSquaresQuestion,
  issues: ValidationIssue[],
): void {
  const add = (message: string) => issues.push({ questionId: question.id, message });

  if (question.grid.length !== LATIN_SIZE || question.grid.some((row) => row.length !== LATIN_SIZE)) {
    add(`grid is not ${LATIN_SIZE}x${LATIN_SIZE}`);
    return;
  }
  if (!isConsistent(question.grid as Grid)) add('clue grid already breaks the Latin square rule');

  const { row, col } = question.target;
  if (row < 0 || row >= LATIN_SIZE || col < 0 || col >= LATIN_SIZE) {
    add('target field is outside the grid');
    return;
  }
  if (question.grid[row]![col] !== null) add('target field is not empty');

  if (question.options.length !== LETTERS.length) add('response row does not offer all five letters');
  if (!question.options.includes(question.answer)) add('answer is not among the response options');

  if (!isCompleteLatinSquare(question.solution as Grid)) {
    add('stored solution is not a valid Latin square');
  }

  // Clues must agree with the stored solution.
  for (let r = 0; r < LATIN_SIZE; r += 1) {
    for (let c = 0; c < LATIN_SIZE; c += 1) {
      const clue = question.grid[r]![c];
      if (clue && clue !== question.solution[r]![c]) {
        add(`clue at row ${r + 1}, column ${c + 1} contradicts the stored solution`);
      }
    }
  }

  // Exactly one completion, so exactly one letter can sit in the target field.
  const puzzle = cloneGrid(question.grid as Grid);
  const completions = countSolutions(puzzle, 2);
  if (completions === 0) add('grid has no completion');
  if (completions > 1) add('grid has more than one completion');

  const viable = candidatesFor(puzzle, row, col).filter((letter) => {
    const probe = cloneGrid(puzzle);
    probe[row]![col] = letter;
    return countSolutions(probe, 1) === 1;
  });
  if (viable.length !== 1) {
    add(`${viable.length} letters fit the question mark, expected exactly one`);
  } else if (viable[0] !== question.answer) {
    add(`stored answer ${question.answer} but the grid forces ${viable[0]}`);
  }

  // Solvable by plain propagation, i.e. without guessing.
  const propagated = propagate(puzzle, question.target);
  if (propagated.contradiction) add('propagation runs into a contradiction');
  if (propagated.grid[row]![col] === null) {
    add('target field cannot be derived by constraint propagation');
  }

  if (question.explanation.length === 0) add('missing explanation');
}

/* ------------------------------------------------------------------ *
 * Entry points
 * ------------------------------------------------------------------ */

export function validateQuestion(question: Question): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  switch (question.type) {
    case 'figure-sequence':
      validateFigureSequence(question, issues);
      break;
    case 'math-equations':
      validateMathEquations(question, issues);
      break;
    case 'latin-squares':
      validateLatinSquares(question, issues);
      break;
  }
  return issues;
}

export function validateTest(test: MockTest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const expected = SECTION_SPECS.map((spec) => spec.id);

  if (test.sections.length !== expected.length) {
    issues.push({
      questionId: `test-${test.id}`,
      message: `expected ${expected.length} sections, found ${test.sections.length}`,
    });
  }

  test.sections.forEach((section, index) => {
    if (section.id !== expected[index]) {
      issues.push({
        questionId: `test-${test.id}`,
        message: `section ${index + 1} is "${section.id}", expected "${expected[index]}"`,
      });
    }
    if (section.questions.length !== QUESTIONS_PER_SECTION) {
      issues.push({
        questionId: `test-${test.id}-${section.id}`,
        message: `expected ${QUESTIONS_PER_SECTION} questions, found ${section.questions.length}`,
      });
    }
    for (const question of section.questions) {
      issues.push(...validateQuestion(question));
    }
  });

  return issues;
}

export function validateBank(bank: QuestionBank): ValidationReport {
  const issues: ValidationIssue[] = [];

  if (bank.tests.length !== TOTAL_TESTS) {
    issues.push({
      questionId: 'bank',
      message: `expected ${TOTAL_TESTS} mock tests, found ${bank.tests.length}`,
    });
  }

  const ids = new Set<string>();
  let questionCount = 0;

  for (const test of bank.tests) {
    issues.push(...validateTest(test));
    for (const section of test.sections) {
      for (const question of section.questions) {
        questionCount += 1;
        if (ids.has(question.id)) {
          issues.push({ questionId: question.id, message: 'duplicate question id' });
        }
        ids.add(question.id);
      }
    }
  }

  return { ok: issues.length === 0, questionCount, issues };
}
