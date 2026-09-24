import {
  DIFFICULTY_PLAN,
  QUESTIONS_PER_SECTION,
  SECTION_SPECS,
  TOTAL_TESTS,
} from '@/data/examSpec';
import { FIGURE_LOAD_PLAN, generateFigureSequenceQuestion } from '@/lib/figureSequence';
import { generateLatinSquaresQuestion, LATIN_STEP_PLAN } from '@/lib/latinSquare';
import { generateMathEquationsQuestion, MATH_LOAD_PLAN } from '@/lib/equations';
import { createRng, hashSeed } from '@/lib/rng';
import { questionSignature } from '@/lib/signature';
import type { Difficulty, MockTest, Question, QuestionBank, SectionId, TestSection } from '@/types';

export const BANK_VERSION = 4;
export const DEFAULT_SEED = 20260421; // Date of the source preparatory materials.

/** How many different seeds a single question may be re-rolled with. */
const MAX_DEDUPE_ATTEMPTS = 400;

function generateQuestion(
  sectionId: SectionId,
  id: string,
  difficulty: Difficulty,
  index: number,
  rng: ReturnType<typeof createRng>,
): Question {
  switch (sectionId) {
    case 'figure-sequences':
      return generateFigureSequenceQuestion(id, difficulty, rng, FIGURE_LOAD_PLAN[index]);
    case 'mathematical-equations':
      return generateMathEquationsQuestion(id, difficulty, rng, MATH_LOAD_PLAN[index]);
    case 'latin-squares':
      return generateLatinSquaresQuestion(id, difficulty, rng, LATIN_STEP_PLAN[index]);
  }
}

/**
 * Generates one question, re-rolling it with a fresh seed until its canonical
 * signature has not been used anywhere else in the bank.
 *
 * `used` is shared across all ten mock tests, which is what makes every one of
 * the 600 tasks distinct rather than merely distinct within its own test.
 */
function generateUniqueQuestion(
  sectionId: SectionId,
  id: string,
  difficulty: Difficulty,
  seed: number,
  testId: number,
  index: number,
  used: Set<string>,
): Question {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_DEDUPE_ATTEMPTS; attempt += 1) {
    // A per-attempt seed keeps the bank reproducible while still giving every
    // retry a genuinely different question.
    const rng = createRng(hashSeed(seed, testId, sectionId, index, attempt));
    let question: Question;
    try {
      question = generateQuestion(sectionId, id, difficulty, index, rng);
    } catch (cause) {
      lastError = cause;
      continue;
    }

    const signature = questionSignature(question);
    if (used.has(signature)) continue;
    used.add(signature);
    return question;
  }

  throw new Error(
    `Unable to generate a distinct ${sectionId} question for ${id} (${difficulty})` +
      (lastError instanceof Error ? `: ${lastError.message}` : ''),
  );
}

export function buildSection(
  testId: number,
  sectionId: SectionId,
  seed: number,
  used: Set<string> = new Set(),
): TestSection {
  const spec = SECTION_SPECS.find((candidate) => candidate.id === sectionId);
  if (!spec) throw new Error(`Unknown section: ${sectionId}`);

  const questions: Question[] = [];
  for (let index = 0; index < QUESTIONS_PER_SECTION; index += 1) {
    const difficulty = DIFFICULTY_PLAN[index] ?? 'medium';
    const id = `t${testId}-${sectionId}-q${index + 1}`;
    questions.push(
      generateUniqueQuestion(sectionId, id, difficulty, seed, testId, index, used),
    );
  }

  return { id: spec.id, order: spec.order, title: spec.title, questions };
}

export function buildTest(testId: number, seed: number, used: Set<string> = new Set()): MockTest {
  return {
    id: testId,
    title: `Mock Test ${testId}`,
    sections: SECTION_SPECS.map((spec) => buildSection(testId, spec.id, seed, used)),
  };
}

export function buildBank(seed: number = DEFAULT_SEED): QuestionBank {
  // One shared signature set for the whole bank: no task repeats anywhere.
  const used = new Set<string>();
  const tests: MockTest[] = [];
  for (let testId = 1; testId <= TOTAL_TESTS; testId += 1) {
    tests.push(buildTest(testId, seed, used));
  }
  return { version: BANK_VERSION, seed, tests };
}
