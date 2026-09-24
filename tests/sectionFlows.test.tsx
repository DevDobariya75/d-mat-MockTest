import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { getTest } from '@/data/questionBank';
import { routes } from '@/routes';
import { ATTEMPTS_KEY, emptyAttempt } from '@/lib/storage';
import type {
  FigureSequenceQuestion,
  MathEquationsQuestion,
  SectionId,
  TestAttempt,
} from '@/types';

/**
 * Drives each of the three question types through a live Test Mode section, so
 * every renderer — including the SVG matrices — is exercised in the real UI, and
 * then checks the score report and the task-by-task review.
 */

const test1 = getTest(1)!;

const renderApp = (initialPath: string) =>
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [initialPath] })} />);

/** Seeds an attempt with the given sections already submitted. */
function seedAttempt(submitted: SectionId[]): TestAttempt {
  const attempt = emptyAttempt(1, Date.now());
  for (const id of submitted) {
    const section = attempt.sections[id]!;
    section.status = 'submitted';
    section.submittedAt = Date.now();
    section.timeUsedMs = 90_000;
  }
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify({ 1: attempt }));
  return attempt;
}

async function startCurrentSection(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Start section' }));
  await user.click(screen.getByRole('button', { name: /Start the 25-minute clock/i }));
  await waitFor(() => expect(screen.getByText('Time remaining')).toBeTruthy());
}

beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
});

describe('figure sequences in Test Mode', () => {
  it('shows four matrices, two blanks and three options per blank', async () => {
    const user = userEvent.setup();
    renderApp('/test/1');
    await startCurrentSection(user);

    // Matrices 1-4 are drawn, and both blanks are marked with a question mark.
    for (let i = 1; i <= 4; i += 1) {
      expect(screen.getByRole('img', { name: new RegExp(`^Matrix ${i}:`) })).toBeTruthy();
    }
    expect(screen.getByRole('img', { name: 'Image 1: unknown matrix' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Image 2: unknown matrix' })).toBeTruthy();

    const imageOne = screen.getByRole('group', { name: /Response options for Image 1/i });
    const imageTwo = screen.getByRole('group', { name: /Response options for Image 2/i });
    expect(within(imageOne).getAllByRole('button')).toHaveLength(3);
    expect(within(imageTwo).getAllByRole('button')).toHaveLength(3);
  });

  it('records one option per blank and reflects it in the palette', async () => {
    const user = userEvent.setup();
    const question = test1.sections[0]!.questions[0] as FigureSequenceQuestion;

    renderApp('/test/1');
    await startCurrentSection(user);

    // Question 1 is still unanswered in the palette.
    expect(screen.getByRole('button', { name: 'Question 1, not answered' })).toBeTruthy();

    // The option buttons read out the matrix they show, then their label.
    const optionFor = (group: HTMLElement, index: number) =>
      within(group).getByRole('button', { name: new RegExp(`Matrix ${index + 1}$`) });

    const imageOne = screen.getByRole('group', { name: /Response options for Image 1/i });
    await user.click(optionFor(imageOne, question.answer[0]!));

    // One of two blanks answered already counts as answered for navigation.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Question 1, answered' })).toBeTruthy();
    });

    const imageTwo = screen.getByRole('group', { name: /Response options for Image 2/i });
    await user.click(optionFor(imageTwo, question.answer[1]!));

    // Clicking the chosen option again clears it.
    await user.click(optionFor(imageTwo, question.answer[1]!));
    expect(within(imageTwo).getByText('not answered')).toBeTruthy();
  });

  it('clears a response with the Clear response action', async () => {
    const user = userEvent.setup();
    const question = test1.sections[0]!.questions[0] as FigureSequenceQuestion;

    renderApp('/test/1');
    await startCurrentSection(user);

    expect(screen.getByRole('button', { name: 'Clear response' })).toHaveProperty('disabled', true);

    const imageOne = screen.getByRole('group', { name: /Response options for Image 1/i });
    await user.click(
      within(imageOne).getByRole('button', {
        name: new RegExp(`Matrix ${question.answer[0]! + 1}$`),
      }),
    );

    const clear = screen.getByRole('button', { name: 'Clear response' });
    expect(clear).toHaveProperty('disabled', false);
    await user.click(clear);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Question 1, not answered' })).toBeTruthy();
    });
  });
});

describe('mathematical equations in Test Mode', () => {
  it('shows the system and takes one value per unknown', async () => {
    const user = userEvent.setup();
    seedAttempt(['figure-sequences']);
    const question = test1.sections[1]!.questions[0] as MathEquationsQuestion;

    renderApp('/test/1');
    await startCurrentSection(user);

    expect(screen.getByText('System of equations')).toBeTruthy();
    for (const equation of question.equations) {
      expect(screen.getByText(equation)).toBeTruthy();
    }

    for (const name of question.variables) {
      const input = screen.getByLabelText(new RegExp(`^Value for ${name},`));
      await user.type(input, String(question.answer[name]));
    }

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Question 1, answered' })).toBeTruthy();
    });
  });
});

describe('result page', () => {
  it('reports the score, the section breakdown and the task-by-task review', async () => {
    const user = userEvent.setup();

    // Submit every section with a handful of correct answers in section 3.
    const attempt = emptyAttempt(1, Date.now());
    const latin = test1.sections[2]!;
    for (const section of test1.sections) {
      const record = attempt.sections[section.id]!;
      record.status = 'submitted';
      record.submittedAt = Date.now();
      record.timeUsedMs = 20 * 60_000;
    }
    const latinRecord = attempt.sections[latin.id]!;
    latin.questions.slice(0, 4).forEach((question) => {
      if (question.type === 'latin-squares') {
        latinRecord.answers[question.id] = question.answer;
      }
    });
    latin.questions.slice(4, 6).forEach((question) => {
      if (question.type === 'latin-squares') {
        latinRecord.answers[question.id] = question.options.find(
          (letter) => letter !== question.answer,
        )!;
      }
    });
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify({ 1: attempt }));

    renderApp('/test/1/result');

    expect(screen.getByRole('heading', { name: /Core Module score report/i })).toBeTruthy();
    expect(screen.getByLabelText('Total score 4 of 60 points')).toBeTruthy();
    expect(screen.getByLabelText('Latin Squares score 4 of 20 points')).toBeTruthy();
    expect(screen.getByLabelText('Figure Sequences score 0 of 20 points')).toBeTruthy();
    expect(screen.getByText(/Total time used/)).toBeTruthy();

    // Section-wise cards for all three subtests.
    expect(screen.getByRole('heading', { name: 'Section-wise score' })).toBeTruthy();
    for (const title of ['Figure Sequences', 'Mathematical Equations', 'Latin Squares']) {
      expect(screen.getAllByRole('heading', { name: title }).length).toBeGreaterThan(0);
    }

    // Switch the review to Latin Squares and open the first task.
    await user.click(screen.getAllByRole('button', { name: 'Latin Squares' })[0]!);
    await waitFor(() => {
      expect(screen.getByText(/4 correct · 0 partial · 2 incorrect · 14 unanswered/)).toBeTruthy();
    });

    const firstQuestion = latin.questions[0]!;
    if (firstQuestion.type !== 'latin-squares') throw new Error('unexpected type');

    expect(screen.getAllByText('Your answer').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Correct answer').length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole('button', { name: 'Show details' })[0]!);
    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: /Solution path/i }).length).toBeGreaterThan(0);
    });

    // Filtering the review narrows it to the incorrect tasks.
    await user.click(screen.getByRole('button', { name: /^Incorrect \(2\)$/ }));
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Show details' })).toHaveLength(2);
    });

    // And all 20 tasks can be listed.
    await user.click(screen.getByRole('button', { name: /^All \(10\)$/ }));
    await user.click(screen.getByRole('button', { name: /Show all 20 tasks/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^All \(20\)$/ })).toBeTruthy();
    });
  });

  it('redirects to the overview when nothing has been submitted yet', async () => {
    renderApp('/test/1/result');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Before you start/i })).toBeTruthy();
    });
  });

  it('shows a partial result while sections are still open', async () => {
    seedAttempt(['figure-sequences']);
    renderApp('/test/1/result');

    expect(screen.getByText(/1 of 3 subtests submitted/)).toBeTruthy();
    // The two open sections cannot be reviewed.
    expect(
      screen.getByRole('button', { name: /Mathematical Equations \(open\)/ }),
    ).toHaveProperty('disabled', true);
  });
});

describe('unknown routes', () => {
  it('falls back to a not-found page', () => {
    renderApp('/nope');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });

  it('sends an unknown test id back to the home page', async () => {
    renderApp('/test/99');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Core Module mock tests/i })).toBeTruthy();
    });
  });
});

describe('practice mode partial answers (regression)', () => {
  it('keeps the second image open after the first one is picked', async () => {
    const user = userEvent.setup();
    const question = test1.sections[0]!.questions[0] as FigureSequenceQuestion;

    renderApp('/practice/1');
    await waitFor(() => expect(screen.getByText('Not answered yet')).toBeTruthy());

    const imageOne = screen.getByRole('group', { name: /Response options for Image 1/i });
    await user.click(
      within(imageOne).getByRole('button', {
        name: new RegExp(`Matrix ${question.answer[0]! + 1}$`),
      }),
    );

    // The task is only half done: no verdict, no solution path, nothing given away.
    await waitFor(() => expect(screen.getByText('In progress')).toBeTruthy());
    expect(screen.queryByRole('heading', { name: /Correct!|Not correct/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: /Solution path/i })).toBeNull();
    expect(screen.getByText(/Complete every part of the task/i)).toBeTruthy();

    // Image 2 is still selectable, and its answer is not marked.
    const imageTwo = screen.getByRole('group', { name: /Response options for Image 2/i });
    const imageTwoButtons = within(imageTwo).getAllByRole('button');
    expect(imageTwoButtons.every((button) => !(button as HTMLButtonElement).disabled)).toBe(true);
    expect(within(imageTwo).queryByText(/Matrix \d ✓/)).toBeNull();

    // Answering it completes the task and only now reveals the verdict.
    await user.click(
      within(imageTwo).getByRole('button', {
        name: new RegExp(`Matrix ${question.answer[1]! + 1}$`),
      }),
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Correct!' })).toBeTruthy();
    });
  });

  it('keeps the remaining unknowns editable until the system is filled in', async () => {
    const user = userEvent.setup();
    const question = test1.sections[1]!.questions[0] as MathEquationsQuestion;
    const [first, ...rest] = question.variables;

    renderApp('/practice/1');
    await user.click(screen.getByRole('button', { name: 'Mathematical Equations' }));
    await waitFor(() => expect(screen.getByText('System of equations')).toBeTruthy());

    const fieldFor = (name: string) => screen.getByLabelText(new RegExp(`^Value for ${name},`));

    await user.type(fieldFor(first!), String(question.answer[first!]));

    // Still in progress: no verdict yet and the other fields stay enabled.
    await waitFor(() => expect(screen.getByText('In progress')).toBeTruthy());
    expect(screen.queryByRole('heading', { name: /Not correct|Correct!/ })).toBeNull();
    for (const name of rest) {
      expect(fieldFor(name)).toHaveProperty('disabled', false);
    }

    for (const name of rest) {
      await user.type(fieldFor(name), String(question.answer[name]));
    }

    // A typed answer is committed by hand, so nothing is revealed until then.
    expect(screen.queryByRole('heading', { name: /Not correct|Correct!/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Check answer' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Correct!' })).toBeTruthy();
    });
  });

  it('lets a two-digit value be typed in full before checking', async () => {
    const user = userEvent.setup();
    const question = test1.sections[1]!.questions.find(
      (candidate): candidate is MathEquationsQuestion =>
        candidate.type === 'math-equations' &&
        candidate.variables.every((name) => (candidate.answer[name] ?? 0) >= 10),
    );
    if (!question) throw new Error('expected a system with only two-digit values');

    const index = test1.sections[1]!.questions.indexOf(question);
    renderApp('/practice/1');
    await user.click(screen.getByRole('button', { name: 'Mathematical Equations' }));
    await user.click(screen.getByRole('button', { name: new RegExp(`^Question ${index + 1},`) }));
    await waitFor(() => expect(screen.getByText(`Question ${index + 1}`)).toBeTruthy());

    for (const name of question.variables) {
      const field = screen.getByLabelText(new RegExp(`^Value for ${name},`));
      await user.type(field, String(question.answer[name]));
      // The full two-digit value survives: the field never locked mid-number.
      expect((field as HTMLInputElement).value).toBe(String(question.answer[name]));
    }

    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Correct!' })).toBeTruthy();
    });
  });

  it('commits a typed answer with the Enter key', async () => {
    const user = userEvent.setup();
    const question = test1.sections[1]!.questions[0] as MathEquationsQuestion;

    renderApp('/practice/1');
    await user.click(screen.getByRole('button', { name: 'Mathematical Equations' }));
    await waitFor(() => expect(screen.getByText('System of equations')).toBeTruthy());

    for (const name of question.variables) {
      await user.type(
        screen.getByLabelText(new RegExp(`^Value for ${name},`)),
        String(question.answer[name]),
      );
    }
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Correct!' })).toBeTruthy();
    });
  });

  it('can still reveal the answer of an unfinished task on request', async () => {
    const user = userEvent.setup();

    renderApp('/practice/1');
    await user.click(screen.getByRole('button', { name: 'Show answer' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Answer revealed' })).toBeTruthy();
    });
    expect(screen.getByRole('heading', { name: /Solution path/i })).toBeTruthy();
  });
});
