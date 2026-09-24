import type { SectionId } from '@/types';

/**
 * Exam rules extracted from the official dMAT preparatory materials
 * ("dMAT - Preparatory Materials for Test Takers", g.a.s.t. / TestDaF-Institut,
 * as at 21.04.2026). See `docs/DMAT_EXAM_SPEC.md` for the full write-up.
 */

export const SECTION_DURATION_MS = 25 * 60 * 1000;

export const GRID_SIZE = 4; // Figure Sequences matrices are 4x4.
export const LATIN_SIZE = 5; // Latin Squares are 5x5.
export const FIGURE_OPTION_COUNT = 3; // Three response matrices per blank.
export const QUESTIONS_PER_SECTION = 20;
export const MIN_VARIABLE_VALUE = 1;
export const MAX_VARIABLE_VALUE = 20;

export interface SectionSpec {
  id: SectionId;
  order: number;
  title: string;
  /** Short reminder shown inside the running section, as in the real exam. */
  reminder: string;
  /** Full instructions, shown before the section is started. */
  instructions: string[];
  rules: string[];
  answerHint: string;
}

export const SECTION_SPECS: SectionSpec[] = [
  {
    id: 'figure-sequences',
    order: 1,
    title: 'Figure Sequences',
    reminder:
      'Continue the series logically and pick the correct matrix for Image 1 and Image 2.',
    instructions: [
      'In this task you will see a series of pictures (matrices). The figures in the matrices can change their position, colour and/or orientation from one matrix to the next according to specific rules.',
      'It is your task to continue the series logically and to determine what the next two matrices look like.',
      'Four matrices are given. For each of the two missing matrices — Image 1 (matrix 5) and Image 2 (matrix 6) — choose one of three response matrices.',
      'In the exam you have a total of 25 minutes for 20 series of matrices. Please be as quick and accurate as possible. If you do not know an answer, please guess which answer might be correct.',
    ],
    rules: [
      'Figures can change their colour.',
      'Figures can rotate around their own axis.',
      'Figures can move in the matrix. Vertical, horizontal and diagonal movements are allowed. Figures cannot change from one diagonal movement to another type of movement.',
      'Figures can also change their movement, colour or orientation by x + 1. Example: if a figure moves one step from matrix 1 to matrix 2, it moves 2 steps from matrix 2 to matrix 3, then 3 steps, etc.',
      'Figures cannot disappear or overlap.',
      'Figures cannot leave the matrix. If they come up against an outer boundary they can either bounce off or move along the outer boundary.',
    ],
    answerHint: 'Select one response matrix for Image 1 and one for Image 2.',
  },
  {
    id: 'mathematical-equations',
    order: 2,
    title: 'Mathematical Equations',
    reminder: 'Find the value of every unknown so that all equations are correct.',
    instructions: [
      'In this task, you are supposed to solve systems of equations in such a way that all requirements are met. One system of equations always consists of several single equations.',
      'Your task is to find out which numbers must be used for the unknowns (letters) in the equations so that all equations are correct.',
      'There is always only one solution for each letter, in which all requirements are met.',
      'Each letter can be an integer between 1 and 20.',
      'In the exam you have 25 minutes to solve 20 systems of equations. Please be as quick and accurate as possible.',
    ],
    rules: [
      'Every unknown is an integer between 1 and 20 (inclusive).',
      'Each system has exactly one solution — any other solution is wrong.',
      'A system counts as solved only when every unknown is correct.',
    ],
    answerHint: 'Enter one whole number between 1 and 20 for each unknown.',
  },
  {
    id: 'latin-squares',
    order: 3,
    title: 'Latin Squares',
    reminder: 'Decide which letter belongs in the field with the question mark.',
    instructions: [
      'In this task you will see a 5x5 grid (a square containing 5 rows and 5 columns).',
      'Some fields of the grid contain letters. Each letter can only appear once in each row and each column. Only the letters that are shown as response options can appear in the grid.',
      'Your task is to decide which letter belongs in the field with the question mark. Sometimes you need to fill in other fields in your mind before you can figure out what letter should replace the question mark.',
      'If you know what the correct solution for the question mark field is, click on the correct response in the solution row.',
      'In the exam you have 25 minutes for 20 tasks. Please be as quick and accurate as possible! If you do not know an answer, please guess which answer might be correct.',
    ],
    rules: [
      'Each of the letters A-E appears exactly once in every row and exactly once in every column.',
      'Only the letters offered as response options may be used.',
      'Exactly one letter fits the field with the question mark.',
    ],
    answerHint: 'Click the letter that belongs in the highlighted field.',
  },
];

export const SECTION_SPEC_BY_ID: Record<SectionId, SectionSpec> = SECTION_SPECS.reduce(
  (acc, spec) => {
    acc[spec.id] = spec;
    return acc;
  },
  {} as Record<SectionId, SectionSpec>,
);

/** Instructions shown on the Test Mode landing screen, before section 1. */
export const GENERAL_INSTRUCTIONS: string[] = [
  'This mock test reproduces the Core Module of the dMAT, which measures general study aptitude. It consists of three subtests, taken in a fixed order: Figure Sequences, Mathematical Equations and Latin Squares.',
  'Each subtest gives you 25 minutes for 20 tasks — 60 tasks and 75 minutes in total.',
  'Once you start a subtest you cannot leave it, restart it or pause it. The countdown keeps running, and the subtest is submitted automatically when it reaches zero.',
  'Between two subtests you may take as much time as you like. A submitted subtest is locked and cannot be retaken.',
  'You may not take notes during the exam, and no helping tools are available. Answer as quickly and accurately as possible; there is no penalty for a wrong answer, so guess rather than leave a task open.',
  'Each subtest is taken in fullscreen and with your camera switched on. Leaving fullscreen or turning the camera off hides the questions until you restore it, and the clock keeps running. The camera preview stays on your device — nothing is recorded, stored or uploaded.',
];

/**
 * Difficulty mix per section. The preparatory materials offer every task type in
 * the levels low / medium / high, so each 20-task subtest ramps up accordingly.
 */
export const DIFFICULTY_PLAN: ('low' | 'medium' | 'high')[] = [
  ...Array.from({ length: 6 }, () => 'low' as const),
  ...Array.from({ length: 8 }, () => 'medium' as const),
  ...Array.from({ length: 6 }, () => 'high' as const),
];

export const TOTAL_TESTS = 10;
