import bankJson from '@/data/generated/tests.json';
import type { MockTest, Question, QuestionBank, SectionId, TestSection } from '@/types';

/**
 * The committed question bank: 10 mock tests x 3 sections x 20 questions.
 * Regenerate with `npm run generate:questions`.
 */
export const questionBank = bankJson as unknown as QuestionBank;

export const mockTests: MockTest[] = questionBank.tests;

export const getTest = (testId: number): MockTest | undefined =>
  mockTests.find((test) => test.id === testId);

export function getSection(testId: number, sectionId: SectionId): TestSection | undefined {
  return getTest(testId)?.sections.find((section) => section.id === sectionId);
}

export function getQuestion(
  testId: number,
  sectionId: SectionId,
  questionId: string,
): Question | undefined {
  return getSection(testId, sectionId)?.questions.find((question) => question.id === questionId);
}

export const totalQuestionCount = mockTests.reduce(
  (total, test) =>
    total + test.sections.reduce((sum, section) => sum + section.questions.length, 0),
  0,
);
