/**
 * Domain model for the dMAT Core Module mock tests.
 *
 * All structures here are plain JSON-serialisable data so that the whole
 * question bank can live in `src/data/generated/tests.json` and user progress
 * can round-trip through `localStorage` without custom (de)serialisation.
 */

export type Difficulty = 'low' | 'medium' | 'high';

export type SectionId = 'figure-sequences' | 'mathematical-equations' | 'latin-squares';

/* ------------------------------------------------------------------ *
 * Figure Sequences
 * ------------------------------------------------------------------ */

/** The eight glyphs used by the official preparatory materials. */
export type FigureShape =
  | 'square'
  | 'diamond'
  | 'hexagon'
  | 'triangle'
  | 'arrow'
  | 'arc'
  | 'bracket'
  | 'circle';

export type FigureColor =
  | 'blue'
  | 'yellow'
  | 'pink'
  | 'green'
  | 'orange'
  | 'black'
  | 'white';

export type Rotation = 0 | 90 | 180 | 270;

export interface Figure {
  shape: FigureShape;
  color: FigureColor;
  rotation: Rotation;
  /** 0-based row in the 4x4 matrix, counted from the top. */
  row: number;
  /** 0-based column in the 4x4 matrix, counted from the left. */
  col: number;
}

/** One 4x4 matrix of a figure sequence. */
export interface FigureMatrix {
  figures: Figure[];
}

export interface FigureSequenceQuestion {
  id: string;
  type: 'figure-sequence';
  difficulty: Difficulty;
  /** Matrices 1-4, always shown to the test taker. */
  given: FigureMatrix[];
  /**
   * Three response options for each of the two blanks ("Image 1" = matrix 5,
   * "Image 2" = matrix 6), mirroring the official response layout.
   */
  options: [FigureMatrix[], FigureMatrix[]];
  /** Index (0-2) of the correct option for each blank. */
  answer: [number, number];
  /** One bullet per figure, describing the rule it follows. */
  explanation: string[];
}

/** A submitted answer: one option index per blank, `null` when left open. */
export type FigureSequenceAnswer = [number | null, number | null];

/* ------------------------------------------------------------------ *
 * Mathematical Equations
 * ------------------------------------------------------------------ */

export interface MathEquationsQuestion {
  id: string;
  type: 'math-equations';
  difficulty: Difficulty;
  /** Rendered equations, e.g. `"3 × C = A"`. */
  equations: string[];
  /** Unknowns in display order, e.g. `['A', 'B', 'C']`. */
  variables: string[];
  /** The unique solution; every value is an integer in [1, 20]. */
  answer: Record<string, number>;
  /** Step-by-step solution path. */
  explanation: string[];
}

/** A submitted answer: one value per unknown, `null` when left open. */
export type MathEquationsAnswer = Record<string, number | null>;

/* ------------------------------------------------------------------ *
 * Latin Squares
 * ------------------------------------------------------------------ */

export type LatinLetter = 'A' | 'B' | 'C' | 'D' | 'E';

export interface LatinSquaresQuestion {
  id: string;
  type: 'latin-squares';
  difficulty: Difficulty;
  /** 5x5 grid of clues; `null` marks an empty field. */
  grid: (LatinLetter | null)[][];
  /** Coordinates of the field carrying the red question mark. */
  target: { row: number; col: number };
  /** Response options, always the five letters A-E. */
  options: LatinLetter[];
  answer: LatinLetter;
  /** The full completed square, used for the post-test review. */
  solution: LatinLetter[][];
  /** Deduction chain in the notation of the official solution key. */
  explanation: string[];
}

export type LatinSquaresAnswer = LatinLetter | null;

/* ------------------------------------------------------------------ *
 * Unions
 * ------------------------------------------------------------------ */

export type Question =
  | FigureSequenceQuestion
  | MathEquationsQuestion
  | LatinSquaresQuestion;

export type QuestionType = Question['type'];

export type Answer = FigureSequenceAnswer | MathEquationsAnswer | LatinSquaresAnswer;

export interface TestSection {
  id: SectionId;
  /** 1-based position in the exam. Sections must be taken in this order. */
  order: number;
  title: string;
  questions: Question[];
}

export interface MockTest {
  id: number;
  title: string;
  sections: TestSection[];
}

export interface QuestionBank {
  /** Schema version, bumped when the generated shape changes. */
  version: number;
  /** Seed the bank was generated from, for reproducibility. */
  seed: number;
  tests: MockTest[];
}

/* ------------------------------------------------------------------ *
 * Attempts & persistence
 * ------------------------------------------------------------------ */

export type SectionStatus = 'not-started' | 'in-progress' | 'submitted';

export interface SectionAttempt {
  status: SectionStatus;
  /** Epoch ms when the section clock started. */
  startedAt: number | null;
  /** Epoch ms when the clock expires; the single source of truth for the timer. */
  endsAt: number | null;
  submittedAt: number | null;
  /** Wall-clock time actually spent, in ms. */
  timeUsedMs: number;
  autoSubmitted: boolean;
  /** How often the test taker left fullscreen while this section was running. */
  fullscreenExits: number;
  /** How often the camera stopped while this section was running. */
  cameraInterruptions: number;
  /** Keyed by question id. */
  answers: Record<string, Answer>;
  /** Question ids flagged "marked for review". */
  marked: string[];
  /** Question ids the test taker has visited. */
  visited: string[];
  /** Index of the question shown when the section is resumed. */
  cursor: number;
}

export interface TestAttempt {
  testId: number;
  startedAt: number;
  /** Keyed by `SectionId`. */
  sections: Record<string, SectionAttempt>;
}

export interface PracticeProgress {
  testId: number;
  /** Keyed by question id. */
  answers: Record<string, Answer>;
  /** Question ids whose feedback has been revealed. */
  revealed: string[];
  lastSectionId: SectionId;
  cursor: number;
  updatedAt: number;
}

/* ------------------------------------------------------------------ *
 * Scoring
 * ------------------------------------------------------------------ */

export type QuestionOutcome = 'correct' | 'partial' | 'incorrect' | 'unanswered';

export interface QuestionScore {
  questionId: string;
  outcome: QuestionOutcome;
  /** Points awarded, in [0, 1]. */
  points: number;
  maxPoints: number;
}

export interface SectionScore {
  sectionId: SectionId;
  title: string;
  points: number;
  maxPoints: number;
  correct: number;
  partial: number;
  incorrect: number;
  unanswered: number;
  total: number;
  /** points / maxPoints, in [0, 1]. */
  percentage: number;
  /** points / attempted, in [0, 1]; 0 when nothing was attempted. */
  accuracy: number;
  timeUsedMs: number;
  autoSubmitted: boolean;
  /** Fullscreen exits recorded while the section was running. */
  fullscreenExits: number;
  /** Camera interruptions recorded while the section was running. */
  cameraInterruptions: number;
  questions: QuestionScore[];
}

export interface TestScore {
  testId: number;
  points: number;
  maxPoints: number;
  percentage: number;
  correct: number;
  partial: number;
  incorrect: number;
  unanswered: number;
  total: number;
  accuracy: number;
  timeUsedMs: number;
  sections: SectionScore[];
}
