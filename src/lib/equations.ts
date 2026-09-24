import { MAX_VARIABLE_VALUE, MIN_VARIABLE_VALUE } from '@/data/examSpec';
import type { Difficulty, MathEquationsQuestion } from '@/types';
import type { Rng } from '@/lib/rng';

/**
 * Engine for the "Mathematical Equations" subtest.
 *
 * A system of single equations uses letters as unknowns. Every unknown is an
 * integer between 1 and 20 and every system has exactly one solution.
 *
 * Internally each equation is kept in the linear form
 *
 *     sum(coeffs[v] * value(v)) + constant === 0
 *
 * alongside its rendered string. That makes uniqueness provable by brute force
 * over the whole 1..20 domain, which is what `solveSystem` does.
 */

export const VARIABLE_NAMES = ['A', 'B', 'C', 'D'];

export interface LinearEquation {
  coeffs: Record<string, number>;
  constant: number;
  /** Human-readable form, e.g. `"3 × C = A"`. */
  display: string;
}

export const TIMES = '×';
export const DIVIDE = '÷';

const inDomain = (value: number): boolean =>
  Number.isInteger(value) && value >= MIN_VARIABLE_VALUE && value <= MAX_VARIABLE_VALUE;

export function evaluate(equation: LinearEquation, values: Record<string, number>): number {
  let total = equation.constant;
  for (const [name, coeff] of Object.entries(equation.coeffs)) {
    total += coeff * (values[name] ?? 0);
  }
  return total;
}

export function satisfies(
  equations: LinearEquation[],
  values: Record<string, number>,
): boolean {
  return equations.every((equation) => evaluate(equation, values) === 0);
}

/**
 * Brute-forces every assignment in [1, 20]^n and returns all solutions, up to
 * `limit`. With at most four unknowns this is 160 000 candidates, which is
 * cheap enough to run for every generated question and again in the test suite.
 */
export function solveSystem(
  variables: string[],
  equations: LinearEquation[],
  limit = 2,
): Record<string, number>[] {
  const solutions: Record<string, number>[] = [];
  const values: Record<string, number> = {};

  const search = (index: number): void => {
    if (solutions.length >= limit) return;
    if (index === variables.length) {
      if (satisfies(equations, values)) solutions.push({ ...values });
      return;
    }
    const name = variables[index]!;
    for (let value = MIN_VARIABLE_VALUE; value <= MAX_VARIABLE_VALUE; value += 1) {
      values[name] = value;
      // Prune as soon as every unknown of an equation is bound.
      const bound = variables.slice(0, index + 1);
      const ready = equations.filter((equation) =>
        Object.keys(equation.coeffs).every((key) => bound.includes(key)),
      );
      if (ready.every((equation) => evaluate(equation, values) === 0)) {
        search(index + 1);
      }
      if (solutions.length >= limit) break;
    }
    delete values[name];
  };

  search(0);
  return solutions;
}

/* ------------------------------------------------------------------ *
 * Equation builders
 * ------------------------------------------------------------------ */

/** `<pivot> <op> <k> = <target>` and friends: defines `target` from `pivot`. */
type DefinitionBuilder = (
  pivot: string,
  target: string,
  values: Record<string, number>,
  rng: Rng,
) => LinearEquation | null;

const oneStepBuilders: DefinitionBuilder[] = [
  // k × P = V
  (pivot, target, values, rng) => {
    const k = rng.int(2, 5);
    if (values[pivot]! * k !== values[target]) return null;
    return {
      coeffs: { [pivot]: k, [target]: -1 },
      constant: 0,
      display: `${k} ${TIMES} ${pivot} = ${target}`,
    };
  },
  // P ÷ k = V
  (pivot, target, values, rng) => {
    const k = rng.int(2, 4);
    if (values[pivot]! !== values[target]! * k) return null;
    return {
      coeffs: { [pivot]: 1, [target]: -k },
      constant: 0,
      display: `${pivot} ${DIVIDE} ${k} = ${target}`,
    };
  },
  // P + k = V
  (pivot, target, values) => {
    const k = values[target]! - values[pivot]!;
    if (k < 1) return null;
    return {
      coeffs: { [pivot]: 1, [target]: -1 },
      constant: k,
      display: `${pivot} + ${k} = ${target}`,
    };
  },
  // P - k = V
  (pivot, target, values) => {
    const k = values[pivot]! - values[target]!;
    if (k < 1) return null;
    return {
      coeffs: { [pivot]: 1, [target]: -1 },
      constant: -k,
      display: `${pivot} - ${k} = ${target}`,
    };
  },
  // n - P = V
  (pivot, target, values) => {
    const n = values[pivot]! + values[target]!;
    // Keep the literal in the range the official examples use (13, 18, 25...).
    if (n < 2 || n > 30) return null;
    return {
      coeffs: { [pivot]: -1, [target]: -1 },
      constant: n,
      display: `${n} - ${pivot} = ${target}`,
    };
  },
];

/** Definitions that need a multiplication and an addition or subtraction. */
const twoStepBuilders: DefinitionBuilder[] = [
  // k × P - m = V
  (pivot, target, values, rng) => {
    const k = rng.int(2, 4);
    const m = k * values[pivot]! - values[target]!;
    if (m < 1) return null;
    return {
      coeffs: { [pivot]: k, [target]: -1 },
      constant: -m,
      display: `${k} ${TIMES} ${pivot} - ${m} = ${target}`,
    };
  },
  // k × P + m = V
  (pivot, target, values, rng) => {
    const k = rng.int(2, 4);
    const m = values[target]! - k * values[pivot]!;
    if (m < 1) return null;
    return {
      coeffs: { [pivot]: k, [target]: -1 },
      constant: m,
      display: `${k} ${TIMES} ${pivot} + ${m} = ${target}`,
    };
  },
];

/** `k × X + m × Y = V`: defines `target` from two already-known unknowns. */
function buildCombinationDefinition(
  sources: string[],
  target: string,
  values: Record<string, number>,
  rng: Rng,
): LinearEquation | null {
  if (sources.length < 2) return null;
  const [x, y] = rng.shuffle(sources);
  if (!x || !y) return null;
  const k = rng.int(1, 3);
  const m = rng.int(1, 3);
  if (k * values[x]! + m * values[y]! !== values[target]) return null;
  const left = [
    k === 1 ? x : `${k} ${TIMES} ${x}`,
    m === 1 ? y : `${m} ${TIMES} ${y}`,
  ].join(' + ');
  return {
    coeffs: { [x]: k, [y]: m, [target]: -1 },
    constant: 0,
    display: `${left} = ${target}`,
  };
}

/** Equations that pin the pivot down on their own. */
const pinBuilders: DefinitionBuilder[] = [
  // k + P = n
  (pivot, _target, values, rng) => {
    const k = rng.int(2, 12);
    const n = k + values[pivot]!;
    return {
      coeffs: { [pivot]: 1 },
      constant: k - n,
      display: `${k} + ${pivot} = ${n}`,
    };
  },
  // P - k = n
  (pivot, _target, values, rng) => {
    const k = rng.int(1, Math.max(1, values[pivot]! - 1));
    const n = values[pivot]! - k;
    if (n < 1) return null;
    return {
      coeffs: { [pivot]: 1 },
      constant: -k - n,
      display: `${pivot} - ${k} = ${n}`,
    };
  },
  // k × P = n
  (pivot, _target, values, rng) => {
    const k = rng.int(2, 5);
    const n = k * values[pivot]!;
    return {
      coeffs: { [pivot]: k },
      constant: -n,
      display: `${k} ${TIMES} ${pivot} = ${n}`,
    };
  },
  // k × P + m = n
  (pivot, _target, values, rng) => {
    const k = rng.int(2, 4);
    const m = rng.int(1, 12);
    const n = k * values[pivot]! + m;
    return {
      coeffs: { [pivot]: k },
      constant: m - n,
      display: `${k} ${TIMES} ${pivot} + ${m} = ${n}`,
    };
  },
  // k × P - m = n
  (pivot, _target, values, rng) => {
    const k = rng.int(2, 4);
    const m = rng.int(1, 12);
    const n = k * values[pivot]! - m;
    if (n < 1) return null;
    return {
      coeffs: { [pivot]: k },
      constant: -m - n,
      display: `${k} ${TIMES} ${pivot} - ${m} = ${n}`,
    };
  },
];

/**
 * `A - B + C - D = n`: a signed sum over every unknown. Solving it after the
 * definitions have been substituted is what fixes the pivot.
 */
function buildSignedSum(
  variables: string[],
  values: Record<string, number>,
  rng: Rng,
): LinearEquation | null {
  const order = rng.shuffle(variables);
  const signs = order.map((_, index) => (index === 0 ? 1 : rng.bool(0.5) ? 1 : -1));
  let total = 0;
  const coeffs: Record<string, number> = {};
  const parts: string[] = [];
  order.forEach((name, index) => {
    const sign = signs[index]!;
    total += sign * values[name]!;
    coeffs[name] = sign;
    parts.push(index === 0 ? name : `${sign === 1 ? '+' : '-'} ${name}`);
  });
  if (total < 1) return null;
  return {
    coeffs,
    constant: -total,
    display: `${parts.join(' ')} = ${total}`,
  };
}

/**
 * `X + Y = n` / `X - Y = n`: a pin that uses the pivot plus one other unknown.
 * With `weighted`, the pivot carries a factor, e.g. `2 × A + B = n`.
 */
function buildPairPin(
  pivot: string,
  other: string,
  values: Record<string, number>,
  rng: Rng,
  weighted = false,
): LinearEquation | null {
  if (weighted) {
    const k = rng.int(2, 3);
    if (rng.bool()) {
      const n = k * values[pivot]! + values[other]!;
      return {
        coeffs: { [pivot]: k, [other]: 1 },
        constant: -n,
        display: `${k} ${TIMES} ${pivot} + ${other} = ${n}`,
      };
    }
    const n = k * values[pivot]! - values[other]!;
    if (n < 1) return null;
    return {
      coeffs: { [pivot]: k, [other]: -1 },
      constant: -n,
      display: `${k} ${TIMES} ${pivot} - ${other} = ${n}`,
    };
  }
  if (rng.bool()) {
    const n = values[pivot]! + values[other]!;
    return {
      coeffs: { [pivot]: 1, [other]: 1 },
      constant: -n,
      display: `${pivot} + ${other} = ${n}`,
    };
  }
  const n = values[other]! - values[pivot]!;
  if (n < 1) return null;
  return {
    coeffs: { [other]: 1, [pivot]: -1 },
    constant: -n,
    display: `${other} - ${pivot} = ${n}`,
  };
}

/* ------------------------------------------------------------------ *
 * Question generation
 * ------------------------------------------------------------------ */

const VARIABLE_COUNT: Record<Difficulty, number> = { low: 2, medium: 3, high: 4 };

/**
 * How the equations of a level are drawn. None of this changes the shape of a
 * system (2 / 3 / 4 unknowns and equations); it only decides how much
 * arithmetic each equation carries.
 */
interface EquationProfile {
  /** Chance that a definition needs two operations, e.g. `3 × C - 1 = B`. */
  twoStepChance: number;
  /** Chance that a definition combines two known unknowns, e.g. `2 × A + C = B`. */
  combinationChance: number;
  /** Chance that the pinning equation is a signed sum over every unknown. */
  signedSumChance: number;
  /** Chance that a pair pin carries a factor, e.g. `2 × A + B = 23`. */
  weightedPinChance: number;
}

const PROFILE: Record<Difficulty, EquationProfile> = {
  low: { twoStepChance: 0.6, combinationChance: 0, signedSumChance: 0, weightedPinChance: 0.5 },
  medium: { twoStepChance: 0.5, combinationChance: 0.5, signedSumChance: 0.6, weightedPinChance: 0.4 },
  high: { twoStepChance: 0.6, combinationChance: 0.55, signedSumChance: 0.7, weightedPinChance: 0.4 },
};

/**
 * Work an equation asks for: one per arithmetic operator plus one per unknown
 * it links. `3 × C - 1 = B` scores 4, `C + 3 = B` scores 3, `A + B = 20` scores 3.
 */
export function equationLoad(display: string): number {
  const operators = (display.match(/[+\-×÷]/g) ?? []).length;
  const unknowns = new Set(display.match(/[A-D]/g) ?? []).size;
  return operators + unknowns;
}

export const systemLoad = (displays: string[]): number =>
  displays.reduce((total, display) => total + equationLoad(display), 0);

/**
 * Exact `systemLoad` for each of the 20 slots of a section, aligned with
 * `DIFFICULTY_PLAN` (6 low, 8 medium, 6 high). Fixing the load per slot makes
 * every mock test equally hard and keeps the easy-to-hard ramp inside a section.
 */
export const MATH_LOAD_PLAN: number[] = [
  6, 6, 7, 7, 7, 8,
  12, 12, 13, 13, 13, 14, 14, 15,
  17, 18, 18, 19, 19, 21,
];

/** Accepted `systemLoad` range per level when no exact target is given. */
const LOAD_RANGE: Record<Difficulty, { min: number; max: number }> = {
  low: { min: 6, max: 8 },
  medium: { min: 12, max: 15 },
  high: { min: 17, max: 21 },
};

function buildExplanation(
  pivot: string,
  pinDisplay: string,
  definitions: { display: string; target: string }[],
  answer: Record<string, number>,
): string[] {
  const lines: string[] = [];
  if (definitions.length > 0) {
    lines.push(
      `Every other unknown is expressed through ${pivot}: ${definitions
        .map((d) => d.display)
        .join('; ')}.`,
    );
  }
  lines.push(
    `Substituting those into "${pinDisplay}" leaves ${pivot} as the only unknown, which gives ${pivot} = ${answer[pivot]}.`,
  );
  for (const definition of definitions) {
    lines.push(
      `Inserting ${pivot} = ${answer[pivot]} into "${definition.display}" gives ${definition.target} = ${answer[definition.target]}.`,
    );
  }
  lines.push(
    `Solution: ${Object.keys(answer)
      .sort()
      .map((name) => `${name} = ${answer[name]}`)
      .join(', ')}. Any other solution is wrong.`,
  );
  return lines;
}

/**
 * `targetLoad` pins the system to an exact `systemLoad`; without it any load in
 * the level's `LOAD_RANGE` is accepted.
 */
export function generateMathEquationsQuestion(
  id: string,
  difficulty: Difficulty,
  rng: Rng,
  targetLoad?: number,
): MathEquationsQuestion {
  const variableCount = VARIABLE_COUNT[difficulty];
  const variables = VARIABLE_NAMES.slice(0, variableCount);
  const profile = PROFILE[difficulty];
  const { min: minLoad, max: maxLoad } =
    targetLoad === undefined ? LOAD_RANGE[difficulty] : { min: targetLoad, max: targetLoad };

  for (let attempt = 0; attempt < 4000; attempt += 1) {
    const values: Record<string, number> = {};
    for (const name of variables) {
      values[name] = rng.int(MIN_VARIABLE_VALUE, MAX_VARIABLE_VALUE);
    }
    if (!variables.every((name) => inDomain(values[name]!))) continue;

    const pivot = rng.pick(variables);
    const others = rng.shuffle(variables.filter((name) => name !== pivot));

    const definitions: { equation: LinearEquation; target: string }[] = [];
    let failed = false;
    const known: string[] = [pivot];

    for (const target of others) {
      let equation: LinearEquation | null = null;
      // From medium upwards, occasionally define an unknown from two others.
      if (known.length >= 2 && rng.bool(profile.combinationChance)) {
        equation = buildCombinationDefinition(known, target, values, rng);
      }
      if (!equation) {
        const twoStepFirst = rng.bool(profile.twoStepChance);
        const builders = twoStepFirst
          ? [...rng.shuffle(twoStepBuilders), ...rng.shuffle(oneStepBuilders)]
          : [...rng.shuffle(oneStepBuilders), ...rng.shuffle(twoStepBuilders)];
        for (const builder of builders) {
          equation = builder(pivot, target, values, rng);
          if (equation) break;
        }
      }
      if (!equation) {
        failed = true;
        break;
      }
      definitions.push({ equation, target });
      known.push(target);
    }
    if (failed) continue;

    // The pinning equation. From medium upwards it always involves at least two
    // unknowns, so the pivot can never be read straight off a single equation.
    let pin: LinearEquation | null = null;
    if (difficulty === 'low') {
      if (rng.bool(0.5) && others[0]) {
        pin = buildPairPin(pivot, others[0], values, rng, rng.bool(profile.weightedPinChance));
      }
      if (!pin) {
        for (const builder of rng.shuffle(pinBuilders)) {
          pin = builder(pivot, pivot, values, rng);
          if (pin) break;
        }
      }
    } else {
      if (rng.bool(profile.signedSumChance)) {
        pin = buildSignedSum(variables, values, rng);
      }
      if (!pin && others[0]) {
        pin = buildPairPin(pivot, others[0], values, rng, rng.bool(profile.weightedPinChance));
      }
      if (!pin) pin = buildSignedSum(variables, values, rng);
      if (!pin) continue;
      if (Object.keys(pin.coeffs).length < 2) continue;
    }
    if (!pin) continue;

    const equations = [...definitions.map((d) => d.equation), pin];
    const load = systemLoad(equations.map((equation) => equation.display));
    if (load < minLoad || load > maxLoad) continue;
    if (!satisfies(equations, values)) continue;

    // Prove the system has exactly one solution over the whole domain.
    const solutions = solveSystem(variables, equations, 2);
    if (solutions.length !== 1) continue;

    const displayOrder = rng.shuffle(equations);
    const answer: Record<string, number> = {};
    for (const name of variables) answer[name] = values[name]!;

    return {
      id,
      type: 'math-equations',
      difficulty,
      equations: displayOrder.map((equation) => equation.display),
      variables: [...variables],
      answer,
      explanation: buildExplanation(
        pivot,
        pin.display,
        definitions.map((d) => ({ display: d.equation.display, target: d.target })),
        answer,
      ),
    };
  }

  throw new Error(`Unable to generate an equation system for ${id} (${difficulty})`);
}
