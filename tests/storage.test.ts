import { describe, expect, it } from 'vitest';

import { SECTION_DURATION_MS } from '@/data/examSpec';
import {
  ATTEMPTS_KEY,
  PRACTICE_KEY,
  clearAllAttempts,
  clearAttempt,
  clearPracticeProgress,
  emptyAttempt,
  emptySectionAttempt,
  loadAttempt,
  loadAttempts,
  loadPracticeProgress,
  saveAttempt,
  savePracticeProgress,
} from '@/lib/storage';
import type { TestAttempt } from '@/types';

const START = 1_700_000_000_000;

describe('attempt persistence', () => {
  it('returns no attempt for a test that was never started', () => {
    expect(loadAttempt(3)).toBeNull();
    expect(loadAttempts()).toEqual({});
  });

  it('creates an attempt with one entry per section, all not started', () => {
    const attempt = emptyAttempt(1, START);
    expect(attempt.testId).toBe(1);
    expect(attempt.startedAt).toBe(START);
    expect(Object.keys(attempt.sections)).toEqual([
      'figure-sequences',
      'mathematical-equations',
      'latin-squares',
    ]);
    for (const section of Object.values(attempt.sections)) {
      expect(section.status).toBe('not-started');
      expect(section.endsAt).toBeNull();
    }
  });

  it('round-trips an attempt, including the deadline and the answers', () => {
    const attempt = emptyAttempt(2, START);
    const section = attempt.sections['figure-sequences']!;
    section.status = 'in-progress';
    section.startedAt = START;
    section.endsAt = START + SECTION_DURATION_MS;
    section.answers['t2-figure-sequences-q1'] = [1, 2];
    section.marked = ['t2-figure-sequences-q3'];
    section.visited = ['t2-figure-sequences-q1', 't2-figure-sequences-q3'];
    section.cursor = 2;

    saveAttempt(attempt);

    const loaded = loadAttempt(2)!;
    expect(loaded.sections['figure-sequences']).toEqual(section);
    expect(loaded.startedAt).toBe(START);
  });

  it('keeps attempts for different tests apart', () => {
    saveAttempt(emptyAttempt(1, START));
    saveAttempt(emptyAttempt(5, START + 10));

    expect(Object.keys(loadAttempts()).sort()).toEqual(['1', '5']);
    expect(loadAttempt(5)!.startedAt).toBe(START + 10);
    expect(loadAttempt(2)).toBeNull();
  });

  it('overwrites the stored attempt on a later save', () => {
    const attempt = emptyAttempt(1, START);
    saveAttempt(attempt);

    attempt.sections['latin-squares']!.status = 'submitted';
    attempt.sections['latin-squares']!.timeUsedMs = 90_000;
    saveAttempt(attempt);

    const loaded = loadAttempt(1)!;
    expect(loaded.sections['latin-squares']!.status).toBe('submitted');
    expect(loaded.sections['latin-squares']!.timeUsedMs).toBe(90_000);
  });

  it('clears one attempt without touching the others', () => {
    saveAttempt(emptyAttempt(1, START));
    saveAttempt(emptyAttempt(2, START));

    clearAttempt(1);

    expect(loadAttempt(1)).toBeNull();
    expect(loadAttempt(2)).not.toBeNull();
  });

  it('clears every attempt at once', () => {
    saveAttempt(emptyAttempt(1, START));
    saveAttempt(emptyAttempt(2, START));

    clearAllAttempts();

    expect(loadAttempts()).toEqual({});
  });
});

describe('defensive reads', () => {
  it('ignores a value that is not valid JSON', () => {
    localStorage.setItem(ATTEMPTS_KEY, 'not json at all');
    expect(loadAttempts()).toEqual({});
  });

  it('ignores a value of the wrong shape', () => {
    localStorage.setItem(ATTEMPTS_KEY, '"a string"');
    expect(loadAttempts()).toEqual({});
    localStorage.setItem(ATTEMPTS_KEY, '[1, 2, 3]');
    expect(loadAttempt(1)).toBeNull();
  });

  it('drops entries whose key is not a test id', () => {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify({ banana: emptyAttempt(1, START) }));
    expect(loadAttempts()).toEqual({});
  });

  it('repairs a partial section record instead of crashing', () => {
    localStorage.setItem(
      ATTEMPTS_KEY,
      JSON.stringify({
        1: {
          testId: 1,
          startedAt: START,
          sections: {
            'figure-sequences': { status: 'in-progress', endsAt: START + 1000 },
            'mathematical-equations': { status: 'nonsense', answers: 'oops', marked: 'nope' },
          },
        },
      }),
    );

    const loaded = loadAttempt(1)!;
    const figures = loaded.sections['figure-sequences']!;
    expect(figures.status).toBe('in-progress');
    expect(figures.endsAt).toBe(START + 1000);
    expect(figures.answers).toEqual({});
    expect(figures.marked).toEqual([]);

    const equations = loaded.sections['mathematical-equations']!;
    expect(equations.status).toBe('not-started');
    expect(equations.answers).toEqual({});
    expect(equations.marked).toEqual([]);

    // The missing third section is filled in with a fresh record.
    expect(loaded.sections['latin-squares']).toEqual(emptySectionAttempt());
  });

  it('rejects a negative cursor and non-numeric timings', () => {
    localStorage.setItem(
      ATTEMPTS_KEY,
      JSON.stringify({
        1: {
          testId: 1,
          sections: {
            'latin-squares': { status: 'submitted', cursor: -4, timeUsedMs: 'soon', endsAt: 'later' },
          },
        },
      }),
    );

    const section = loadAttempt(1)!.sections['latin-squares']!;
    expect(section.cursor).toBe(0);
    expect(section.timeUsedMs).toBe(0);
    expect(section.endsAt).toBeNull();
  });
});

describe('practice progress persistence', () => {
  it('returns null before anything was practised', () => {
    expect(loadPracticeProgress(1)).toBeNull();
  });

  it('round-trips answers, revealed questions, section and cursor', () => {
    savePracticeProgress({
      testId: 4,
      answers: { 'q-1': 'C', 'q-2': [0, 1] },
      revealed: ['q-1'],
      lastSectionId: 'latin-squares',
      cursor: 7,
      updatedAt: START,
    });

    const loaded = loadPracticeProgress(4)!;
    expect(loaded.answers).toEqual({ 'q-1': 'C', 'q-2': [0, 1] });
    expect(loaded.revealed).toEqual(['q-1']);
    expect(loaded.lastSectionId).toBe('latin-squares');
    expect(loaded.cursor).toBe(7);
    expect(loaded.updatedAt).toBe(START);
  });

  it('falls back to the first section when the stored one is unknown', () => {
    localStorage.setItem(
      PRACTICE_KEY,
      JSON.stringify({ 1: { testId: 1, lastSectionId: 'algebra', cursor: 'x' } }),
    );

    const loaded = loadPracticeProgress(1)!;
    expect(loaded.lastSectionId).toBe('figure-sequences');
    expect(loaded.cursor).toBe(0);
    expect(loaded.answers).toEqual({});
  });

  it('clears practice progress for one test only', () => {
    savePracticeProgress({
      testId: 1,
      answers: {},
      revealed: [],
      lastSectionId: 'figure-sequences',
      cursor: 0,
      updatedAt: START,
    });
    savePracticeProgress({
      testId: 2,
      answers: {},
      revealed: [],
      lastSectionId: 'figure-sequences',
      cursor: 0,
      updatedAt: START,
    });

    clearPracticeProgress(1);

    expect(loadPracticeProgress(1)).toBeNull();
    expect(loadPracticeProgress(2)).not.toBeNull();
  });
});

describe('attempts and practice progress are stored independently', () => {
  it('uses separate keys', () => {
    const attempt: TestAttempt = emptyAttempt(1, START);
    saveAttempt(attempt);
    savePracticeProgress({
      testId: 1,
      answers: { x: 'A' },
      revealed: ['x'],
      lastSectionId: 'figure-sequences',
      cursor: 0,
      updatedAt: START,
    });

    expect(localStorage.getItem(ATTEMPTS_KEY)).toBeTruthy();
    expect(localStorage.getItem(PRACTICE_KEY)).toBeTruthy();

    clearAllAttempts();
    expect(loadPracticeProgress(1)).not.toBeNull();
  });
});
