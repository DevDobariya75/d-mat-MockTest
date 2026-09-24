import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SECTION_DURATION_MS } from '@/data/examSpec';
import { getTest } from '@/data/questionBank';
import { routes } from '@/routes';
import { loadAttempt } from '@/lib/storage';
import type { LatinSquaresQuestion } from '@/types';

/**
 * End-to-end flows through the real router, exercising the two modes the way a
 * test taker does: home -> instructions -> running section -> submit -> result,
 * and home -> practice -> answer -> feedback.
 */

const renderApp = (initialPath: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  return { router, ...render(<RouterProvider router={router} />) };
};

beforeEach(() => {
  // getUserMedia does not exist in jsdom; the camera must degrade gracefully.
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: undefined,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('home page', () => {
  it('lists all ten mock tests with both modes', () => {
    renderApp('/');

    expect(screen.getByRole('heading', { name: /Core Module mock tests/i })).toBeTruthy();
    for (let id = 1; id <= 10; id += 1) {
      expect(screen.getByRole('heading', { name: `Mock Test ${id}` })).toBeTruthy();
    }
    expect(screen.getAllByRole('link', { name: 'Test Mode' })).toHaveLength(10);
    expect(screen.getAllByRole('link', { name: 'Practice Mode' })).toHaveLength(10);
  });
});

describe('test mode flow', () => {
  it('shows the instructions and only offers section 1', async () => {
    renderApp('/test/1');

    expect(screen.getByRole('heading', { name: /Before you start/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Figure Sequences', level: 3 })).toBeTruthy();

    // Exactly one section can be started; the other two are locked.
    expect(screen.getAllByRole('button', { name: 'Start section' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Locked' })).toHaveLength(2);
    expect(screen.getByText(/Complete section 1 before starting section 2/i)).toBeTruthy();
  });

  it('confirms before starting the clock, then runs the section', async () => {
    const user = userEvent.setup();
    renderApp('/test/1');

    await user.click(screen.getByRole('button', { name: 'Start section' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/cannot leave it, pause it or restart it/i)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Start the 25-minute clock/i }));

    await waitFor(() => {
      expect(screen.getByText('Time remaining')).toBeTruthy();
    });
    expect(screen.getByText('25:00')).toBeTruthy();
    expect(screen.getByText('Section locked')).toBeTruthy();
    // No way out: the running screen has no navigation links.
    expect(screen.queryByRole('link', { name: /All mock tests/i })).toBeNull();

    const stored = loadAttempt(1)!;
    expect(stored.sections['figure-sequences']!.status).toBe('in-progress');
    expect(stored.sections['figure-sequences']!.endsAt).not.toBeNull();
  });

  it('cannot be entered by deep-linking into a section that has not been started', async () => {
    renderApp('/test/1/section/latin-squares');

    // The clock may only be started from the overview, so the user is bounced back.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Before you start/i })).toBeTruthy();
    });
  });

  it('runs the whole Latin Squares section and reports a score', async () => {
    const user = userEvent.setup();
    const test = getTest(1)!;
    const latin = test.sections[2]!.questions as LatinSquaresQuestion[];

    // Pre-submit the first two sections so section 3 is unlocked.
    const attempt = {
      testId: 1,
      startedAt: Date.now(),
      sections: {
        'figure-sequences': {
          status: 'submitted',
          startedAt: 0,
          endsAt: null,
          submittedAt: 0,
          timeUsedMs: 60_000,
          autoSubmitted: false,
          answers: {},
          marked: [],
          visited: [],
          cursor: 0,
        },
        'mathematical-equations': {
          status: 'submitted',
          startedAt: 0,
          endsAt: null,
          submittedAt: 0,
          timeUsedMs: 60_000,
          autoSubmitted: false,
          answers: {},
          marked: [],
          visited: [],
          cursor: 0,
        },
        'latin-squares': {
          status: 'not-started',
          startedAt: null,
          endsAt: null,
          submittedAt: null,
          timeUsedMs: 0,
          autoSubmitted: false,
          answers: {},
          marked: [],
          visited: [],
          cursor: 0,
        },
      },
    };
    localStorage.setItem('dmat.attempts.v1', JSON.stringify({ 1: attempt }));

    renderApp('/test/1');

    await user.click(screen.getByRole('button', { name: 'Start section' }));
    await user.click(screen.getByRole('button', { name: /Start the 25-minute clock/i }));

    await waitFor(() => expect(screen.getByText('Time remaining')).toBeTruthy());

    // Answer question 1 correctly.
    await user.click(screen.getByRole('button', { name: latin[0]!.answer }));
    // Mark it for review.
    await user.click(screen.getByRole('button', { name: 'Mark for review' }));
    // The badge on the question plus the counter in the exam header.
    expect(screen.getAllByText('marked for review').length).toBeGreaterThan(0);

    // Jump to question 5 with the palette and answer it correctly too.
    await user.click(screen.getByRole('button', { name: /^Question 5,/ }));
    await waitFor(() => expect(screen.getByText('Question 5')).toBeTruthy());
    await user.click(screen.getByRole('button', { name: latin[4]!.answer }));

    // Step back with Previous.
    await user.click(screen.getByRole('button', { name: /Previous/ }));
    await waitFor(() => expect(screen.getByText('Question 4')).toBeTruthy());

    const saved = loadAttempt(1)!.sections['latin-squares']!;
    expect(saved.answers[latin[0]!.id]).toBe(latin[0]!.answer);
    expect(saved.answers[latin[4]!.id]).toBe(latin[4]!.answer);
    expect(saved.marked).toContain(latin[0]!.id);

    // Submit, confirm, then land back on the overview, now complete.
    await user.click(screen.getAllByRole('button', { name: 'Submit section' })[0]!);
    await user.click(screen.getByRole('button', { name: /Submit and lock/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Section submitted' })).toBeTruthy();
    });
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(screen.getByText('Test completed')).toBeTruthy();
    });
    // Two correct answers out of 60 tasks.
    expect(screen.getByText(/2 \/ 60 \(3%\)/)).toBeTruthy();
    expect(loadAttempt(1)!.sections['latin-squares']!.status).toBe('submitted');
  });

  it('auto-submits when the clock runs out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderApp('/test/1');
    await user.click(screen.getByRole('button', { name: 'Start section' }));
    await user.click(screen.getByRole('button', { name: /Start the 25-minute clock/i }));
    await waitFor(() => expect(screen.getByText('Time remaining')).toBeTruthy());

    // Jump the wall clock past the deadline, then let one tick observe it.
    // (Advancing 25 minutes tick by tick would run the interval 6000 times.)
    vi.setSystemTime(Date.now() + SECTION_DURATION_MS + 1_000);
    await vi.advanceTimersByTimeAsync(500);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Time is up' })).toBeTruthy();
    });

    const stored = loadAttempt(1)!.sections['figure-sequences']!;
    expect(stored.status).toBe('submitted');
    expect(stored.autoSubmitted).toBe(true);
  });

  it('resumes a running section instead of showing the overview', async () => {
    const attempt = {
      testId: 2,
      startedAt: Date.now(),
      sections: {
        'figure-sequences': {
          status: 'in-progress',
          startedAt: Date.now(),
          endsAt: Date.now() + SECTION_DURATION_MS,
          submittedAt: null,
          timeUsedMs: 0,
          autoSubmitted: false,
          answers: {},
          marked: [],
          visited: [],
          cursor: 6,
        },
      },
    };
    localStorage.setItem('dmat.attempts.v1', JSON.stringify({ 2: attempt }));

    renderApp('/test/2');

    await waitFor(() => {
      expect(screen.getByText('Section locked')).toBeTruthy();
    });
    // The cursor is restored where it was left.
    expect(screen.getByText('Question 7')).toBeTruthy();
  });
});

describe('practice mode flow', () => {
  it('has no timer and no section locking', async () => {
    const user = userEvent.setup();
    renderApp('/practice/1');

    expect(screen.queryByText('Time remaining')).toBeNull();
    expect(screen.getByRole('heading', { name: /Practice by task type/i })).toBeTruthy();

    // All three sections are reachable straight away.
    await user.click(screen.getByRole('button', { name: 'Latin Squares' }));
    await waitFor(() => {
      // The task reminder above the question, plus the full instructions below it.
      expect(screen.getAllByText(/Decide which letter belongs/i).length).toBeGreaterThan(0);
    });
  });

  it('gives immediate feedback with the correct answer and the solution path', async () => {
    const user = userEvent.setup();
    const latin = getTest(1)!.sections[2]!.questions[0] as LatinSquaresQuestion;
    const wrong = latin.options.find((letter) => letter !== latin.answer)!;

    renderApp('/practice/1');
    await user.click(screen.getByRole('button', { name: 'Latin Squares' }));
    await waitFor(() => expect(screen.getByText('Not answered yet')).toBeTruthy());

    await user.click(screen.getByRole('button', { name: wrong }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Not correct' })).toBeTruthy();
    });
    expect(screen.getByText(`Letter ${latin.answer}`)).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Solution path/i })).toBeTruthy();

    // Retrying clears the feedback so the task can be attempted again.
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Not correct' })).toBeNull();
    });
  });

  it('confirms a correct answer', async () => {
    const user = userEvent.setup();
    const latin = getTest(1)!.sections[2]!.questions[0] as LatinSquaresQuestion;

    renderApp('/practice/1');
    await user.click(screen.getByRole('button', { name: 'Latin Squares' }));
    await user.click(screen.getByRole('button', { name: latin.answer }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Correct!' })).toBeTruthy();
    });
  });
});
