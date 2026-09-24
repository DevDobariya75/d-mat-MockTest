import { SECTION_SPECS } from '@/data/examSpec';
import type { MockTest, SectionAttempt, SectionId, TestAttempt } from '@/types';

/**
 * The rules that govern Test Mode.
 *
 * Sections are taken in the fixed order of the real exam. A section can only be
 * started when every earlier section has been submitted, a running section can
 * neither be left nor restarted, and a submitted section is locked for good.
 * Between two sections the test taker may take as long as they like.
 */

export type SectionAvailability =
  | { state: 'locked'; reason: string }
  | { state: 'available' }
  | { state: 'in-progress' }
  | { state: 'submitted' };

export const orderedSectionIds = (): SectionId[] =>
  [...SECTION_SPECS].sort((a, b) => a.order - b.order).map((spec) => spec.id);

export function sectionAttemptOf(
  attempt: TestAttempt | null,
  sectionId: SectionId,
): SectionAttempt | undefined {
  return attempt?.sections[sectionId];
}

export function sectionAvailability(
  attempt: TestAttempt | null,
  sectionId: SectionId,
): SectionAvailability {
  const order = orderedSectionIds();
  const index = order.indexOf(sectionId);
  if (index < 0) return { state: 'locked', reason: 'Unknown section.' };

  const own = sectionAttemptOf(attempt, sectionId);
  if (own?.status === 'submitted') return { state: 'submitted' };
  if (own?.status === 'in-progress') return { state: 'in-progress' };

  // A running section blocks every other section.
  const running = order.find((id) => sectionAttemptOf(attempt, id)?.status === 'in-progress');
  if (running && running !== sectionId) {
    return { state: 'locked', reason: 'Finish the section you are currently taking first.' };
  }

  for (let i = 0; i < index; i += 1) {
    const previous = sectionAttemptOf(attempt, order[i]!);
    if (previous?.status !== 'submitted') {
      return {
        state: 'locked',
        reason: `Complete section ${i + 1} before starting section ${index + 1}.`,
      };
    }
  }

  return { state: 'available' };
}

export const canStartSection = (attempt: TestAttempt | null, sectionId: SectionId): boolean =>
  sectionAvailability(attempt, sectionId).state === 'available';

/** The section currently in progress, if any. */
export function runningSectionId(attempt: TestAttempt | null): SectionId | null {
  return (
    orderedSectionIds().find((id) => sectionAttemptOf(attempt, id)?.status === 'in-progress') ??
    null
  );
}

/** The next section the test taker should start, or `null` when the test is done. */
export function nextSectionId(attempt: TestAttempt | null): SectionId | null {
  return (
    orderedSectionIds().find((id) => sectionAttemptOf(attempt, id)?.status !== 'submitted') ?? null
  );
}

export const isTestComplete = (attempt: TestAttempt | null): boolean =>
  attempt !== null &&
  orderedSectionIds().every((id) => sectionAttemptOf(attempt, id)?.status === 'submitted');

export function submittedSectionCount(attempt: TestAttempt | null): number {
  return orderedSectionIds().filter(
    (id) => sectionAttemptOf(attempt, id)?.status === 'submitted',
  ).length;
}

/** Remaining time on a section's clock, clamped to zero. */
export function remainingMs(section: SectionAttempt | undefined, now = Date.now()): number {
  if (!section || section.status !== 'in-progress' || section.endsAt === null) return 0;
  return Math.max(0, section.endsAt - now);
}

/** True when a running section's clock has already run out. */
export function hasExpired(section: SectionAttempt | undefined, now = Date.now()): boolean {
  return (
    section?.status === 'in-progress' &&
    section.endsAt !== null &&
    now >= section.endsAt
  );
}

export type PaletteStatus =
  | 'unanswered'
  | 'answered'
  | 'marked'
  | 'answered-marked'
  | 'visited';

/** Overall progress label for the Test Mode overview. */
export function testProgressLabel(test: MockTest, attempt: TestAttempt | null): string {
  const done = submittedSectionCount(attempt);
  if (done === 0) return 'Not started';
  if (done === test.sections.length) return 'Completed';
  return `${done} of ${test.sections.length} sections done`;
}
