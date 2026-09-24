import { SECTION_SPECS } from '@/data/examSpec';
import type { PracticeProgress, SectionAttempt, SectionId, TestAttempt } from '@/types';

/**
 * localStorage persistence.
 *
 * Everything the platform remembers lives under two versioned keys. Reads are
 * defensive: a missing, malformed or foreign value is treated as "no data"
 * rather than crashing the app, because the store is user-writable.
 */

export const ATTEMPTS_KEY = 'dmat.attempts.v1';
export const PRACTICE_KEY = 'dmat.practice.v1';

type AttemptMap = Record<string, TestAttempt>;
type PracticeMap = Record<string, PracticeProgress>;

const memoryFallback = new Map<string, string>();

/** Returns a usable storage, falling back to memory in private/blocked modes. */
function storage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__dmat_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch {
    // Fall through to the in-memory shim.
  }
  return {
    getItem: (key) => memoryFallback.get(key) ?? null,
    setItem: (key, value) => void memoryFallback.set(key, value),
    removeItem: (key) => void memoryFallback.delete(key),
  };
}

function readJson<T>(key: string): T | null {
  try {
    const raw = storage().getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object') return null;
    return parsed as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    storage().setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage blocked: progress simply is not persisted.
  }
}

/* ------------------------------------------------------------------ *
 * Attempts (Test Mode)
 * ------------------------------------------------------------------ */

export function emptySectionAttempt(): SectionAttempt {
  return {
    status: 'not-started',
    startedAt: null,
    endsAt: null,
    submittedAt: null,
    timeUsedMs: 0,
    autoSubmitted: false,
    fullscreenExits: 0,
    cameraInterruptions: 0,
    answers: {},
    marked: [],
    visited: [],
    cursor: 0,
  };
}

export function emptyAttempt(testId: number, now = Date.now()): TestAttempt {
  const sections: Record<string, SectionAttempt> = {};
  for (const spec of SECTION_SPECS) sections[spec.id] = emptySectionAttempt();
  return { testId, startedAt: now, sections };
}

/** Repairs a persisted attempt so the rest of the app can rely on its shape. */
function normaliseAttempt(testId: number, raw: unknown): TestAttempt | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<TestAttempt>;
  const base = emptyAttempt(testId, typeof candidate.startedAt === 'number' ? candidate.startedAt : Date.now());

  for (const spec of SECTION_SPECS) {
    const stored = (candidate.sections as Record<string, unknown> | undefined)?.[spec.id];
    if (!stored || typeof stored !== 'object') continue;
    const section = stored as Partial<SectionAttempt>;
    base.sections[spec.id] = {
      status:
        section.status === 'in-progress' || section.status === 'submitted'
          ? section.status
          : 'not-started',
      startedAt: typeof section.startedAt === 'number' ? section.startedAt : null,
      endsAt: typeof section.endsAt === 'number' ? section.endsAt : null,
      submittedAt: typeof section.submittedAt === 'number' ? section.submittedAt : null,
      timeUsedMs: typeof section.timeUsedMs === 'number' ? section.timeUsedMs : 0,
      autoSubmitted: section.autoSubmitted === true,
      fullscreenExits:
        typeof section.fullscreenExits === 'number' && section.fullscreenExits >= 0
          ? section.fullscreenExits
          : 0,
      cameraInterruptions:
        typeof section.cameraInterruptions === 'number' && section.cameraInterruptions >= 0
          ? section.cameraInterruptions
          : 0,
      answers:
        section.answers && typeof section.answers === 'object' ? { ...section.answers } : {},
      marked: Array.isArray(section.marked) ? section.marked.filter((id) => typeof id === 'string') : [],
      visited: Array.isArray(section.visited)
        ? section.visited.filter((id) => typeof id === 'string')
        : [],
      cursor: typeof section.cursor === 'number' && section.cursor >= 0 ? section.cursor : 0,
    };
  }

  return base;
}

export function loadAttempts(): AttemptMap {
  const raw = readJson<Record<string, unknown>>(ATTEMPTS_KEY);
  if (!raw) return {};
  const result: AttemptMap = {};
  for (const [key, value] of Object.entries(raw)) {
    const testId = Number(key);
    if (!Number.isInteger(testId)) continue;
    const attempt = normaliseAttempt(testId, value);
    if (attempt) result[key] = attempt;
  }
  return result;
}

export function loadAttempt(testId: number): TestAttempt | null {
  return loadAttempts()[String(testId)] ?? null;
}

export function saveAttempt(attempt: TestAttempt): void {
  const all = loadAttempts();
  all[String(attempt.testId)] = attempt;
  writeJson(ATTEMPTS_KEY, all);
}

export function clearAttempt(testId: number): void {
  const all = loadAttempts();
  delete all[String(testId)];
  writeJson(ATTEMPTS_KEY, all);
}

export function clearAllAttempts(): void {
  try {
    storage().removeItem(ATTEMPTS_KEY);
  } catch {
    // Ignore.
  }
}

/* ------------------------------------------------------------------ *
 * Practice progress
 * ------------------------------------------------------------------ */

export function loadPracticeProgress(testId: number): PracticeProgress | null {
  const all = readJson<PracticeMap>(PRACTICE_KEY);
  const stored = all?.[String(testId)];
  if (!stored || typeof stored !== 'object') return null;
  return {
    testId,
    answers: stored.answers && typeof stored.answers === 'object' ? stored.answers : {},
    revealed: Array.isArray(stored.revealed)
      ? stored.revealed.filter((id) => typeof id === 'string')
      : [],
    lastSectionId: (SECTION_SPECS.some((spec) => spec.id === stored.lastSectionId)
      ? stored.lastSectionId
      : SECTION_SPECS[0]!.id) as SectionId,
    cursor: typeof stored.cursor === 'number' && stored.cursor >= 0 ? stored.cursor : 0,
    updatedAt: typeof stored.updatedAt === 'number' ? stored.updatedAt : 0,
  };
}

export function savePracticeProgress(progress: PracticeProgress): void {
  const all = readJson<PracticeMap>(PRACTICE_KEY) ?? {};
  all[String(progress.testId)] = progress;
  writeJson(PRACTICE_KEY, all);
}

export function clearPracticeProgress(testId: number): void {
  const all = readJson<PracticeMap>(PRACTICE_KEY) ?? {};
  delete all[String(testId)];
  writeJson(PRACTICE_KEY, all);
}
