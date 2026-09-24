import { FIGURE_OPTION_COUNT, GRID_SIZE } from '@/data/examSpec';
import type {
  Difficulty,
  Figure,
  FigureColor,
  FigureMatrix,
  FigureSequenceQuestion,
  FigureShape,
  Rotation,
} from '@/types';
import type { Rng } from '@/lib/rng';

/**
 * Engine for the "Figure Sequences" subtest.
 *
 * Six matrices form one series. Matrices 1-4 are shown, matrices 5 and 6 are
 * the two blanks ("Image 1" and "Image 2"). Every figure in the series follows
 * exactly one movement rule plus optional rotation and colour modifiers, taken
 * from the rule list in the official preparatory materials.
 */

export const SEQUENCE_LENGTH = 6;
const GIVEN_COUNT = 4;

export type Direction = 'up' | 'down' | 'left' | 'right';

const DIRECTION_DELTA: Record<Direction, { dr: number; dc: number }> = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
};

export type Motion =
  /** Moves along a fixed row or column, bouncing off the borders. */
  | {
      kind: 'line';
      axis: 'horizontal' | 'vertical';
      step: number;
      direction: 1 | -1;
      accelerate: boolean;
    }
  /** Moves diagonally and retraces its path when it hits a border. */
  | { kind: 'diagonal'; dr: 1 | -1; dc: 1 | -1; step: number; accelerate: boolean }
  /** Moves along the outer border, clockwise (1) or counter clockwise (-1). */
  | { kind: 'border'; direction: 1 | -1; step: number; accelerate: boolean }
  /** Repeats a fixed cycle of directions, one field at a time. */
  | { kind: 'directions'; order: Direction[] }
  /** Circles the four middle fields. */
  | { kind: 'center'; direction: 1 | -1 }
  /** Stays where it is. */
  | { kind: 'static' };

export interface FigureRule {
  shape: FigureShape;
  start: { row: number; col: number };
  motion: Motion;
  /** Quarter turns per step: 0 = none, 1 = 90 degrees right, -1 = 90 degrees left. */
  rotationStep: number;
  /** When set, the figure turns `x + 1` times per step instead of a constant amount. */
  rotationAccelerates: boolean;
  startRotation: Rotation;
  /** Colours cycled through, one per matrix. A single entry means a constant colour. */
  colorCycle: FigureColor[];
}

/* ------------------------------------------------------------------ *
 * Movement simulation
 * ------------------------------------------------------------------ */

const inGrid = (row: number, col: number): boolean =>
  row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE;

/** The outer ring of the matrix, listed clockwise from the top-left corner. */
export function borderRing(): { row: number; col: number }[] {
  const n = GRID_SIZE;
  const ring: { row: number; col: number }[] = [];
  for (let c = 0; c < n; c += 1) ring.push({ row: 0, col: c });
  for (let r = 1; r < n; r += 1) ring.push({ row: r, col: n - 1 });
  for (let c = n - 2; c >= 0; c -= 1) ring.push({ row: n - 1, col: c });
  for (let r = n - 2; r >= 1; r -= 1) ring.push({ row: r, col: 0 });
  return ring;
}

/** The four middle fields, listed clockwise. */
export function centerRing(): { row: number; col: number }[] {
  const a = Math.floor(GRID_SIZE / 2) - 1;
  const b = a + 1;
  return [
    { row: a, col: a },
    { row: a, col: b },
    { row: b, col: b },
    { row: b, col: a },
  ];
}

const ringIndexOf = (
  ring: { row: number; col: number }[],
  row: number,
  col: number,
): number => ring.findIndex((cell) => cell.row === row && cell.col === col);

/** Steps taken between matrix `index + 1` and matrix `index + 2`. */
const stepsAt = (base: number, index: number, accelerate: boolean): number =>
  accelerate ? base + index : base;

/**
 * Simulates one figure across the whole series and returns its position in
 * every matrix. Returns `null` when the rule cannot be followed (for example
 * when a border rule starts off the border).
 */
export function simulatePositions(
  rule: FigureRule,
): { row: number; col: number }[] | null {
  const { motion, start } = rule;
  if (!inGrid(start.row, start.col)) return null;

  const positions: { row: number; col: number }[] = [{ ...start }];

  switch (motion.kind) {
    case 'static': {
      for (let i = 1; i < SEQUENCE_LENGTH; i += 1) positions.push({ ...start });
      return positions;
    }

    case 'line': {
      let row = start.row;
      let col = start.col;
      let dir = motion.direction;
      for (let i = 0; i < SEQUENCE_LENGTH - 1; i += 1) {
        const steps = stepsAt(motion.step, i, motion.accelerate);
        for (let s = 0; s < steps; s += 1) {
          const dr = motion.axis === 'vertical' ? dir : 0;
          const dc = motion.axis === 'horizontal' ? dir : 0;
          if (!inGrid(row + dr, col + dc)) {
            dir = (dir === 1 ? -1 : 1) as 1 | -1;
          }
          const ndr = motion.axis === 'vertical' ? dir : 0;
          const ndc = motion.axis === 'horizontal' ? dir : 0;
          if (!inGrid(row + ndr, col + ndc)) return null;
          row += ndr;
          col += ndc;
        }
        positions.push({ row, col });
      }
      return positions;
    }

    case 'diagonal': {
      let row = start.row;
      let col = start.col;
      let dr: 1 | -1 = motion.dr;
      let dc: 1 | -1 = motion.dc;
      for (let i = 0; i < SEQUENCE_LENGTH - 1; i += 1) {
        const steps = stepsAt(motion.step, i, motion.accelerate);
        for (let s = 0; s < steps; s += 1) {
          if (!inGrid(row + dr, col + dc)) {
            // "Returns the same way": both components reverse, retracing the path.
            dr = (dr === 1 ? -1 : 1) as 1 | -1;
            dc = (dc === 1 ? -1 : 1) as 1 | -1;
          }
          if (!inGrid(row + dr, col + dc)) return null;
          row += dr;
          col += dc;
        }
        positions.push({ row, col });
      }
      return positions;
    }

    case 'border': {
      const ring = borderRing();
      let index = ringIndexOf(ring, start.row, start.col);
      if (index < 0) return null;
      for (let i = 0; i < SEQUENCE_LENGTH - 1; i += 1) {
        const steps = stepsAt(motion.step, i, motion.accelerate);
        index = (index + motion.direction * steps + ring.length * 100) % ring.length;
        positions.push({ ...ring[index]! });
      }
      return positions;
    }

    case 'center': {
      const ring = centerRing();
      let index = ringIndexOf(ring, start.row, start.col);
      if (index < 0) return null;
      for (let i = 0; i < SEQUENCE_LENGTH - 1; i += 1) {
        index = (index + motion.direction + ring.length) % ring.length;
        positions.push({ ...ring[index]! });
      }
      return positions;
    }

    case 'directions': {
      let row = start.row;
      let col = start.col;
      for (let i = 0; i < SEQUENCE_LENGTH - 1; i += 1) {
        const dir = motion.order[i % motion.order.length]!;
        const { dr, dc } = DIRECTION_DELTA[dir];
        if (!inGrid(row + dr, col + dc)) return null;
        row += dr;
        col += dc;
        positions.push({ row, col });
      }
      return positions;
    }
  }
}

const normaliseRotation = (quarterTurns: number): Rotation => {
  const value = ((quarterTurns % 4) + 4) % 4;
  return (value * 90) as Rotation;
};

/** Expands one rule into its figure state for every matrix of the series. */
export function simulateFigure(rule: FigureRule): Figure[] | null {
  const positions = simulatePositions(rule);
  if (!positions) return null;

  let turns = rule.startRotation / 90;

  return positions.map((position, index) => {
    if (index > 0) {
      const amount = rule.rotationAccelerates ? index : 1;
      turns += rule.rotationStep * amount;
    }
    return {
      shape: rule.shape,
      color: rule.colorCycle[index % rule.colorCycle.length]!,
      rotation: normaliseRotation(turns),
      row: position.row,
      col: position.col,
    };
  });
}

/** Builds the six matrices of a series, or `null` if any two figures overlap. */
export function buildSequence(rules: FigureRule[]): FigureMatrix[] | null {
  const tracks: Figure[][] = [];
  for (const rule of rules) {
    const track = simulateFigure(rule);
    if (!track) return null;
    tracks.push(track);
  }

  const matrices: FigureMatrix[] = [];
  for (let i = 0; i < SEQUENCE_LENGTH; i += 1) {
    const figures = tracks.map((track) => track[i]!);
    const occupied = new Set(figures.map((f) => `${f.row},${f.col}`));
    if (occupied.size !== figures.length) return null; // Figures cannot overlap.
    matrices.push({ figures });
  }
  return matrices;
}

/* ------------------------------------------------------------------ *
 * Explanations
 * ------------------------------------------------------------------ */

const SHAPE_LABEL: Record<FigureShape, string> = {
  square: 'square',
  diamond: 'diamond',
  hexagon: 'hexagon',
  triangle: 'triangle',
  arrow: 'arrow',
  arc: 'arc',
  bracket: 'bracket',
  circle: 'circle',
};

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth'];
const ordinal = (index: number): string => ORDINALS[index] ?? `${index + 1}th`;

function describeMotion(motion: Motion, start: { row: number; col: number }): string {
  const fields = (n: number) => (n === 1 ? 'one field' : `${n} fields`);
  switch (motion.kind) {
    case 'static':
      return 'stays in its field from image to image';
    case 'line': {
      const orientation = motion.axis === 'horizontal' ? 'horizontally' : 'vertically';
      const track =
        motion.axis === 'horizontal'
          ? `in the ${ordinal(start.row)} row`
          : `in the ${ordinal(start.col)} column`;
      const amount = motion.accelerate
        ? 'by x + 1 fields (one field, then two fields, then three, and so on)'
        : `by ${fields(motion.step)} at a time`;
      const border = motion.axis === 'horizontal' ? 'right or left' : 'upper or lower';
      return `moves ${orientation} ${track} ${amount} and bounces off the ${border} border`;
    }
    case 'diagonal': {
      const vertical = motion.dr === -1 ? 'upwards' : 'downwards';
      const horizontal = motion.dc === 1 ? 'to the right' : 'to the left';
      const amount = motion.accelerate ? 'by x + 1 fields' : `${fields(motion.step)} at a time`;
      return `moves diagonally ${vertical} ${horizontal} ${amount} until it bounces off a boundary and then returns the same way`;
    }
    case 'border': {
      const sense = motion.direction === 1 ? 'clockwise' : 'counter clockwise';
      const amount = motion.accelerate
        ? 'by x + 1 fields (one field from matrix 1 to matrix 2, two fields from matrix 2 to matrix 3, and so on)'
        : `by ${fields(motion.step)} at a time`;
      return `moves along the outer borders ${sense} ${amount}`;
    }
    case 'center': {
      const sense = motion.direction === 1 ? 'clockwise' : 'counter clockwise';
      return `moves one field ${sense} within the four middle fields`;
    }
    case 'directions':
      return `moves one field at a time, in the repeating order ${motion.order.join(', ')}`;
  }
}

export function describeRule(rule: FigureRule): string {
  const parts: string[] = [describeMotion(rule.motion, rule.start)];

  if (rule.rotationStep !== 0) {
    const sense = rule.rotationStep > 0 ? 'to the right' : 'to the left';
    parts.push(
      rule.rotationAccelerates
        ? `it turns x + 1 times by 90 degrees ${sense} from image to image`
        : `it rotates 90 degrees ${sense} from image to image`,
    );
  }

  if (rule.colorCycle.length > 1) {
    parts.push(`it changes its colour in the order ${rule.colorCycle.join(' to ')}, and so on`);
  }

  return `The ${SHAPE_LABEL[rule.shape]} ${parts.join(', and ')}.`;
}

/* ------------------------------------------------------------------ *
 * Distractors
 * ------------------------------------------------------------------ */

export const matrixKey = (matrix: FigureMatrix): string =>
  matrix.figures
    .map((f) => `${f.shape}:${f.color}:${f.rotation}:${f.row}:${f.col}`)
    .sort()
    .join('|');

const cloneMatrix = (matrix: FigureMatrix): FigureMatrix => ({
  figures: matrix.figures.map((f) => ({ ...f })),
});

const COLOR_POOL: FigureColor[] = [
  'blue',
  'yellow',
  'pink',
  'green',
  'orange',
  'black',
  'white',
];

type PerturbKind = 'shift' | 'rotate' | 'recolor' | 'swap';

/**
 * Produces a near-miss variant of `matrix`: the kind of matrix a test taker
 * lands on after mis-applying exactly one part of one rule.
 */
function perturb(
  matrix: FigureMatrix,
  rules: FigureRule[],
  kind: PerturbKind,
  index: number,
  rng: Rng,
): FigureMatrix | null {
  const next = cloneMatrix(matrix);
  const figure = next.figures[index];
  const rule = rules[index];
  if (!figure || !rule) return null;

  const occupied = new Set(
    next.figures.filter((_, i) => i !== index).map((f) => `${f.row},${f.col}`),
  );

  switch (kind) {
    case 'shift': {
      const candidates = [
        { row: figure.row - 1, col: figure.col },
        { row: figure.row + 1, col: figure.col },
        { row: figure.row, col: figure.col - 1 },
        { row: figure.row, col: figure.col + 1 },
        { row: figure.row - 1, col: figure.col - 1 },
        { row: figure.row + 1, col: figure.col + 1 },
        { row: figure.row - 1, col: figure.col + 1 },
        { row: figure.row + 1, col: figure.col - 1 },
      ].filter((c) => inGrid(c.row, c.col) && !occupied.has(`${c.row},${c.col}`));
      if (candidates.length === 0) return null;
      const target = rng.pick(candidates);
      figure.row = target.row;
      figure.col = target.col;
      return next;
    }

    case 'rotate': {
      if (rule.rotationStep === 0 && rule.colorCycle.length === 1) {
        // Nothing about this figure changes; a lone rotation would be a giveaway
        // only if the shape has a visible orientation, so still allow it.
      }
      figure.rotation = normaliseRotation(figure.rotation / 90 + (rng.bool() ? 1 : 3));
      return next;
    }

    case 'recolor': {
      const pool = (rule.colorCycle.length > 1 ? rule.colorCycle : COLOR_POOL).filter(
        (c) => c !== figure.color,
      );
      if (pool.length === 0) return null;
      figure.color = rng.pick(pool);
      return next;
    }

    case 'swap': {
      if (next.figures.length < 2) return null;
      let other = rng.int(0, next.figures.length - 1);
      if (other === index) other = (other + 1) % next.figures.length;
      const target = next.figures[other]!;
      if (target.row === figure.row && target.col === figure.col) return null;
      const row = figure.row;
      const col = figure.col;
      figure.row = target.row;
      figure.col = target.col;
      target.row = row;
      target.col = col;
      return next;
    }
  }
}

/** Shapes whose orientation is visible, so a rotation distractor is fair. */
const ORIENTED_SHAPES = new Set<FigureShape>(['triangle', 'arrow', 'arc', 'bracket']);

/**
 * Wraps the correct matrix and two near misses into a shuffled option list.
 * Returns the options plus the index of the correct one.
 */
export function buildOptions(
  correct: FigureMatrix,
  rules: FigureRule[],
  rng: Rng,
): { options: FigureMatrix[]; answer: number } | null {
  const correctKey = matrixKey(correct);
  const seen = new Set<string>([correctKey]);
  const distractors: FigureMatrix[] = [];

  /**
   * Which perturbations are fair for figure `index`.
   *
   * A colour swap is only offered to figures that actually change colour during
   * the series; on a constant-colour figure it would be dismissed at a glance.
   * Likewise a rotation only counts for shapes whose orientation is visible.
   */
  const kindsFor = (index: number): PerturbKind[] => {
    const kinds: PerturbKind[] = ['shift'];
    if (correct.figures.length > 1) kinds.push('swap');
    if (ORIENTED_SHAPES.has(correct.figures[index]!.shape)) kinds.push('rotate');
    if ((rules[index]?.colorCycle.length ?? 1) > 1) kinds.push('recolor');
    return kinds;
  };

  const addDistractor = (allowed: (kinds: PerturbKind[]) => PerturbKind[]): boolean => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const index = rng.int(0, correct.figures.length - 1);
      const kinds = allowed(kindsFor(index));
      if (kinds.length === 0) continue;
      const candidate = perturb(correct, rules, rng.pick(kinds), index, rng);
      if (!candidate) continue;
      const key = matrixKey(candidate);
      if (seen.has(key)) continue;
      seen.add(key);
      distractors.push(candidate);
      return true;
    }
    return false;
  };

  // The first distractor always misplaces a figure, so the series cannot be
  // solved without actually working out the movement rules.
  if (!addDistractor((kinds) => kinds.filter((kind) => kind === 'shift' || kind === 'swap'))) {
    return null;
  }
  while (distractors.length < FIGURE_OPTION_COUNT - 1) {
    if (!addDistractor((kinds) => kinds)) return null;
  }

  const options = rng.shuffle([correct, ...distractors]);
  const answer = options.findIndex((m) => matrixKey(m) === correctKey);
  return { options, answer };
}

/* ------------------------------------------------------------------ *
 * Rule sampling
 * ------------------------------------------------------------------ */

const SHAPES: FigureShape[] = [
  'square',
  'diamond',
  'hexagon',
  'triangle',
  'arrow',
  'arc',
  'bracket',
  'circle',
];

const DIRECTION_CYCLES: Direction[][] = [
  ['left', 'up', 'right', 'down'],
  ['down', 'right', 'up', 'left'],
  ['right', 'down', 'left', 'up'],
  ['up', 'left', 'down', 'right'],
];

/**
 * How much each level asks of the test taker. Every knob stays within the rule
 * list of the preparatory materials; a harder level only combines more of them.
 */
interface DifficultyProfile {
  /** Chance of a third (medium) or fourth (high) figure. */
  extraFigureChance: number;
  /** Chance that a figure uses an advanced movement (steps > 1, x + 1, direction cycle). */
  advancedChance: number;
  rotationChance: number;
  /** Chance that a rotating figure turns x + 1 times instead of a constant amount. */
  rotationAccelChance: number;
  colorChance: number;
  /** Chance that a colour-changing figure cycles through three colours rather than two. */
  threeColorChance: number;
  /**
   * Accepted range of `ruleLoad` for a whole series. Keeps every task close to
   * its level, so each mock test ends up equally hard rather than hard on average.
   */
  loadRange: { min: number; max: number };
}

const PROFILE: Record<Difficulty, DifficultyProfile> = {
  low: {
    extraFigureChance: 0,
    advancedChance: 0.35,
    rotationChance: 0.4,
    rotationAccelChance: 0,
    colorChance: 0.25,
    threeColorChance: 0.3,
    loadRange: { min: 2, max: 3 },
  },
  medium: {
    extraFigureChance: 0.65,
    advancedChance: 0.6,
    rotationChance: 0.65,
    rotationAccelChance: 0.2,
    colorChance: 0.5,
    threeColorChance: 0.5,
    loadRange: { min: 5, max: 8 },
  },
  high: {
    extraFigureChance: 0.7,
    advancedChance: 0.85,
    rotationChance: 0.8,
    rotationAccelChance: 0.45,
    colorChance: 0.65,
    threeColorChance: 0.6,
    loadRange: { min: 10, max: 14 },
  },
};

/**
 * Exact `ruleLoad` for each of the 20 slots of a section, aligned with
 * `DIFFICULTY_PLAN` (6 low, 8 medium, 6 high). Fixing the load per slot makes
 * every mock test equally hard and keeps the easy-to-hard ramp inside a section.
 */
export const FIGURE_LOAD_PLAN: number[] = [
  2, 2, 2, 2, 3, 3,
  5, 6, 6, 6, 7, 7, 7, 8,
  11, 12, 12, 12, 13, 13,
];

const isAdvancedMotion = (motion: Motion): boolean => {
  switch (motion.kind) {
    case 'line':
    case 'diagonal':
    case 'border':
      return motion.step > 1 || motion.accelerate;
    case 'directions':
      return true;
    default:
      return false;
  }
};

/**
 * How many separate rule components a test taker has to track to solve the
 * series: one movement per figure, plus one for every advanced movement,
 * rotation, accelerating rotation and colour change beyond the first colour.
 */
export function ruleLoad(rules: FigureRule[]): number {
  return rules.reduce(
    (load, rule) =>
      load +
      1 +
      (isAdvancedMotion(rule.motion) ? 1 : 0) +
      (rule.rotationStep !== 0 ? 1 : 0) +
      (rule.rotationAccelerates ? 1 : 0) +
      (rule.colorCycle.length - 1),
    0,
  );
}

const figureCountFor = (difficulty: Difficulty, rng: Rng): number => {
  const extra = rng.bool(PROFILE[difficulty].extraFigureChance) ? 1 : 0;
  if (difficulty === 'low') return 1;
  if (difficulty === 'medium') return 2 + extra;
  return 3 + extra;
};

function sampleMotion(difficulty: Difficulty, rng: Rng): Motion {
  const simple: Motion[] = [
    {
      kind: 'line',
      axis: rng.bool() ? 'horizontal' : 'vertical',
      step: 1,
      direction: rng.bool() ? 1 : -1,
      accelerate: false,
    },
    {
      kind: 'diagonal',
      dr: rng.bool() ? 1 : -1,
      dc: rng.bool() ? 1 : -1,
      step: 1,
      accelerate: false,
    },
    { kind: 'center', direction: rng.bool() ? 1 : -1 },
    { kind: 'border', direction: rng.bool() ? 1 : -1, step: 1, accelerate: false },
  ];

  const advanced: Motion[] = [
    { kind: 'border', direction: rng.bool() ? 1 : -1, step: rng.int(2, 3), accelerate: false },
    { kind: 'border', direction: rng.bool() ? 1 : -1, step: 1, accelerate: true },
    {
      kind: 'line',
      axis: rng.bool() ? 'horizontal' : 'vertical',
      step: rng.int(1, 2),
      direction: rng.bool() ? 1 : -1,
      accelerate: rng.bool(0.4),
    },
    { kind: 'directions', order: rng.pick(DIRECTION_CYCLES) },
  ];

  return rng.bool(PROFILE[difficulty].advancedChance) ? rng.pick(advanced) : rng.pick(simple);
}

function sampleStart(motion: Motion, rng: Rng): { row: number; col: number } {
  switch (motion.kind) {
    case 'border':
      return rng.pick(borderRing());
    case 'center':
      return rng.pick(centerRing());
    case 'directions':
      // A left/up/right/down cycle needs one field of slack up and to the left.
      return { row: rng.int(1, GRID_SIZE - 1), col: rng.int(1, GRID_SIZE - 1) };
    default:
      return { row: rng.int(0, GRID_SIZE - 1), col: rng.int(0, GRID_SIZE - 1) };
  }
}

function sampleRule(difficulty: Difficulty, shape: FigureShape, rng: Rng): FigureRule {
  const motion = sampleMotion(difficulty, rng);
  const profile = PROFILE[difficulty];
  const canRotate = ORIENTED_SHAPES.has(shape);
  const rotationStep = canRotate && rng.bool(profile.rotationChance) ? (rng.bool() ? 1 : -1) : 0;
  const colorCycle = rng.bool(profile.colorChance)
    ? rng.shuffle(COLOR_POOL).slice(0, rng.bool(profile.threeColorChance) ? 3 : 2)
    : [rng.pick(COLOR_POOL)];

  return {
    shape,
    start: sampleStart(motion, rng),
    motion,
    rotationStep,
    rotationAccelerates: rotationStep !== 0 && rng.bool(profile.rotationAccelChance),
    startRotation: (rng.int(0, 3) * 90) as Rotation,
    colorCycle,
  };
}

/* ------------------------------------------------------------------ *
 * Question generation
 * ------------------------------------------------------------------ */

/**
 * `targetLoad` pins the series to an exact `ruleLoad`; without it any load in
 * the level's `loadRange` is accepted.
 */
export function generateFigureSequenceQuestion(
  id: string,
  difficulty: Difficulty,
  rng: Rng,
  targetLoad?: number,
): FigureSequenceQuestion {
  const { min: minLoad, max: maxLoad } =
    targetLoad === undefined
      ? PROFILE[difficulty].loadRange
      : { min: targetLoad, max: targetLoad };

  // Drawn once, not per attempt: busier series fail the overlap check more
  // often, so re-drawing would quietly bias the bank towards fewer figures.
  const count = figureCountFor(difficulty, rng);
  for (let attempt = 0; attempt < 800; attempt += 1) {
    const shapes = rng.shuffle(SHAPES).slice(0, count);
    const rules = shapes.map((shape) => sampleRule(difficulty, shape, rng));

    // Figures are easier to track apart when they do not all follow the same
    // kind of movement, so re-roll near-duplicates once.
    for (let i = 1; i < rules.length; i += 1) {
      const kinds = rules.slice(0, i).map((rule) => rule.motion.kind);
      if (kinds.includes(rules[i]!.motion.kind)) {
        rules[i] = sampleRule(difficulty, rules[i]!.shape, rng);
      }
    }

    const load = ruleLoad(rules);
    if (load < minLoad || load > maxLoad) continue;

    const matrices = buildSequence(rules);
    if (!matrices) continue;

    // A series is only fair when something actually changes in it.
    if (new Set(matrices.map(matrixKey)).size < 4) continue;

    const first = buildOptions(matrices[GIVEN_COUNT]!, rules, rng);
    const second = buildOptions(matrices[GIVEN_COUNT + 1]!, rules, rng);
    if (!first || !second) continue;

    return {
      id,
      type: 'figure-sequence',
      difficulty,
      given: matrices.slice(0, GIVEN_COUNT),
      options: [first.options, second.options],
      answer: [first.answer, second.answer],
      explanation: rules.map(describeRule),
    };
  }
  throw new Error(`Unable to generate a figure sequence for ${id} (${difficulty})`);
}
