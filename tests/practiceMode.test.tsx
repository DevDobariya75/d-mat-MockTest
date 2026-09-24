import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { getTest } from '@/data/questionBank';
import { usePracticeSession } from '@/hooks/usePracticeSession';
import { isComplete, questionAutoReveals } from '@/lib/scoring';
import { loadPracticeProgress } from '@/lib/storage';
import { LatinSquaresView } from '@/components/questions/LatinSquaresView';
import { MathEquationsView } from '@/components/questions/MathEquationsView';
import type {
  FigureSequenceQuestion,
  LatinSquaresAnswer,
  LatinSquaresQuestion,
  MathEquationsAnswer,
  MathEquationsQuestion,
} from '@/types';

const test1 = getTest(1)!;
const latinQuestions = test1.sections[2]!.questions as LatinSquaresQuestion[];
const figureQuestions = test1.sections[0]!.questions as FigureSequenceQuestion[];

describe('practice session', () => {
  it('starts on the first section with nothing answered and no timer', () => {
    const { result } = renderHook(() => usePracticeSession(1));

    expect(result.current.sectionId).toBe('figure-sequences');
    expect(result.current.cursor).toBe(0);
    expect(result.current.questions).toHaveLength(20);
    expect(result.current.progress).toEqual({ answered: 0, correct: 0, total: 20 });
    // No clock exists in Practice Mode at all.
    expect(result.current).not.toHaveProperty('remainingMs');
  });

  it('reveals feedback as soon as a question is answered', () => {
    const { result } = renderHook(() => usePracticeSession(1));
    const question = figureQuestions[0]!;

    expect(result.current.isRevealed(question.id)).toBe(false);

    act(() => {
      result.current.submitAnswer(question.id, [...question.answer]);
    });

    expect(result.current.isRevealed(question.id)).toBe(true);
    expect(result.current.answerOf(question.id)).toEqual(question.answer);
  });

  it('does not reveal feedback for a still-blank answer', () => {
    const { result } = renderHook(() => usePracticeSession(1));
    const question = figureQuestions[0]!;

    act(() => {
      result.current.submitAnswer(question.id, [null, null]);
    });

    expect(result.current.isRevealed(question.id)).toBe(false);
  });

  it('counts correct answers per section', () => {
    const { result } = renderHook(() => usePracticeSession(1));

    act(() => {
      result.current.setSectionId('latin-squares');
    });
    act(() => {
      result.current.submitAnswer(latinQuestions[0]!.id, latinQuestions[0]!.answer);
      result.current.submitAnswer(latinQuestions[1]!.id, latinQuestions[1]!.answer);
    });
    act(() => {
      const wrong = latinQuestions[2]!.options.find(
        (letter) => letter !== latinQuestions[2]!.answer,
      )!;
      result.current.submitAnswer(latinQuestions[2]!.id, wrong);
    });

    expect(result.current.progress).toEqual({ answered: 3, correct: 2, total: 20 });
  });

  it('lets a question be retried, which hides the feedback again', () => {
    const { result } = renderHook(() => usePracticeSession(1));
    const question = figureQuestions[0]!;

    act(() => {
      result.current.submitAnswer(question.id, [...question.answer]);
    });
    act(() => {
      result.current.retry(question.id);
    });

    expect(result.current.isRevealed(question.id)).toBe(false);
    expect(result.current.answerOf(question.id)).toBeUndefined();
    expect(result.current.progress.answered).toBe(0);
  });

  it('allows free navigation in any direction and direct jumps', () => {
    const { result } = renderHook(() => usePracticeSession(1));

    act(() => {
      result.current.goTo(17);
    });
    expect(result.current.cursor).toBe(17);

    act(() => {
      result.current.next();
    });
    expect(result.current.cursor).toBe(18);

    act(() => {
      result.current.previous();
    });
    expect(result.current.cursor).toBe(17);

    // Neither end can be overshot.
    act(() => {
      result.current.goTo(19);
    });
    act(() => {
      result.current.next();
    });
    expect(result.current.cursor).toBe(19);

    act(() => {
      result.current.goTo(0);
    });
    act(() => {
      result.current.previous();
    });
    expect(result.current.cursor).toBe(0);
  });

  it('switches freely between sections, in any order, with no locking', () => {
    const { result } = renderHook(() => usePracticeSession(1));

    // Jump straight to the last section without touching the first two.
    act(() => {
      result.current.setSectionId('latin-squares');
    });
    expect(result.current.sectionId).toBe('latin-squares');
    expect(result.current.cursor).toBe(0);
    expect(result.current.questions[0]!.type).toBe('latin-squares');

    act(() => {
      result.current.setSectionId('mathematical-equations');
    });
    expect(result.current.questions[0]!.type).toBe('math-equations');
  });

  it('persists progress across a reload', () => {
    const question = latinQuestions[3]!;

    const first = renderHook(() => usePracticeSession(1));
    act(() => {
      first.result.current.setSectionId('latin-squares');
    });
    act(() => {
      first.result.current.submitAnswer(question.id, question.answer);
      first.result.current.goTo(3);
    });
    first.unmount();

    expect(loadPracticeProgress(1)).not.toBeNull();

    const second = renderHook(() => usePracticeSession(1));
    expect(second.result.current.sectionId).toBe('latin-squares');
    expect(second.result.current.cursor).toBe(3);
    expect(second.result.current.answerOf(question.id)).toBe(question.answer);
    expect(second.result.current.isRevealed(question.id)).toBe(true);
  });

  it('keeps practice progress per test', () => {
    const one = renderHook(() => usePracticeSession(1));
    act(() => {
      one.result.current.setSectionId('latin-squares');
    });
    one.unmount();

    const two = renderHook(() => usePracticeSession(2));
    expect(two.result.current.sectionId).toBe('figure-sequences');
  });

  it('resets progress on request', () => {
    const { result } = renderHook(() => usePracticeSession(1));
    const question = figureQuestions[0]!;

    act(() => {
      result.current.submitAnswer(question.id, [...question.answer]);
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.progress.answered).toBe(0);
    expect(loadPracticeProgress(1)).toBeNull();
  });
});

describe('immediate feedback in the question views', () => {
  it('marks the chosen Latin Squares letter right or wrong once revealed', async () => {
    const user = userEvent.setup();
    const question = latinQuestions[0]!;
    const wrong = question.options.find((letter) => letter !== question.answer)!;

    let answer: LatinSquaresAnswer = null;
    const { rerender } = render(
      <LatinSquaresView
        question={question}
        answer={answer}
        onChange={(next) => {
          answer = next;
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: wrong }));
    expect(answer).toBe(wrong);

    // Re-render in the revealed state, as Practice Mode does after answering.
    rerender(
      <LatinSquaresView
        question={question}
        answer={answer}
        onChange={() => undefined}
        disabled
        reveal
      />,
    );

    const correctButton = screen.getByRole('button', { name: question.answer });
    expect(correctButton.className).toContain('emerald');
    const wrongButton = screen.getByRole('button', { name: wrong });
    expect(wrongButton.className).toContain('red');
  });

  it('shows the expected value next to a wrong equation entry', () => {
    const question = test1.sections[1]!.questions[0] as MathEquationsQuestion;
    const first = question.variables[0]!;
    const wrongValue = (question.answer[first]! % 20) + 1;

    const answer: MathEquationsAnswer = {};
    for (const name of question.variables) answer[name] = question.answer[name]!;
    answer[first] = wrongValue;

    render(
      <MathEquationsView
        question={question}
        answer={answer}
        onChange={() => undefined}
        disabled
        reveal
      />,
    );

    expect(screen.getByText(`→ ${question.answer[first]}`)).toBeTruthy();
  });

  it('only accepts whole numbers from 1 to 20 for an unknown', async () => {
    const user = userEvent.setup();
    const question = test1.sections[1]!.questions[0] as MathEquationsQuestion;
    const name = question.variables[0]!;

    let answer: MathEquationsAnswer = {};
    const Harness = () => (
      <MathEquationsView
        question={question}
        answer={answer}
        onChange={(next) => {
          answer = next;
        }}
      />
    );
    const { rerender } = render(<Harness />);

    const input = screen.getByLabelText(new RegExp(`Value for ${name}`));

    await user.type(input, '7');
    expect(answer[name]).toBe(7);

    // 21 is out of range, so the second digit is rejected.
    answer = {};
    rerender(<Harness />);
    await user.clear(input);
    await user.type(input, '2');
    rerender(<Harness />);
    await user.type(input, '1');
    expect(answer[name]).toBe(2);

    // Letters are rejected outright.
    answer = {};
    rerender(<Harness />);
    await user.clear(input);
    await user.type(input, 'x');
    expect(answer[name]).toBeUndefined();
  });
});

describe('feedback waits until the task is finished', () => {
  it('does not reveal a figure series after only the first image is chosen', () => {
    const { result } = renderHook(() => usePracticeSession(1));
    const question = figureQuestions[0]!;

    act(() => {
      result.current.submitAnswer(question.id, [question.answer[0]!, null]);
    });

    // Image 2 is still open, so nothing may be given away yet.
    expect(result.current.isRevealed(question.id)).toBe(false);
    expect(result.current.progress.answered).toBe(0);

    act(() => {
      result.current.submitAnswer(question.id, [question.answer[0]!, question.answer[1]!]);
    });

    expect(result.current.isRevealed(question.id)).toBe(true);
    expect(result.current.progress).toMatchObject({ answered: 1, correct: 1 });
  });

  it('hides the feedback again if a figure answer is taken back apart', () => {
    const { result } = renderHook(() => usePracticeSession(1));
    const question = figureQuestions[0]!;

    act(() => {
      result.current.submitAnswer(question.id, [...question.answer]);
    });
    expect(result.current.isRevealed(question.id)).toBe(true);

    act(() => {
      result.current.submitAnswer(question.id, [question.answer[0]!, null]);
    });
    expect(result.current.isRevealed(question.id)).toBe(false);
  });

  it('never auto-reveals an equation system, so a number can be typed in full', () => {
    const { result } = renderHook(() => usePracticeSession(1));
    const question = test1.sections[1]!.questions[3] as MathEquationsQuestion;

    act(() => {
      result.current.setSectionId('mathematical-equations');
    });
    act(() => {
      result.current.goTo(3);
    });

    const partial: MathEquationsAnswer = {};
    question.variables.forEach((name, index) => {
      partial[name] = index === 0 ? question.answer[name]! : null;
    });

    act(() => {
      result.current.submitAnswer(question.id, partial);
    });
    expect(result.current.isRevealed(question.id)).toBe(false);

    const full: MathEquationsAnswer = {};
    for (const name of question.variables) full[name] = question.answer[name]!;
    act(() => {
      result.current.submitAnswer(question.id, full);
    });
    // Still not revealed: "18" passes through "1", which would look complete and
    // lock the field mid-number. Typed answers are committed by hand instead.
    expect(result.current.isRevealed(question.id)).toBe(false);
    expect(result.current.progress.answered).toBe(1);

    act(() => {
      result.current.revealAnswer(question.id);
    });
    expect(result.current.isRevealed(question.id)).toBe(true);
  });

  it('auto-reveals the click-based task types only', () => {
    expect(questionAutoReveals(figureQuestions[0]!)).toBe(true);
    expect(questionAutoReveals(latinQuestions[0]!)).toBe(true);
    expect(questionAutoReveals(test1.sections[1]!.questions[0]!)).toBe(false);
  });

  it('reveals a Latin square immediately, since one letter finishes it', () => {
    const { result } = renderHook(() => usePracticeSession(1));

    act(() => {
      result.current.setSectionId('latin-squares');
    });
    act(() => {
      result.current.submitAnswer(latinQuestions[0]!.id, latinQuestions[0]!.answer);
    });

    expect(result.current.isRevealed(latinQuestions[0]!.id)).toBe(true);
  });

  it('reveals on request, even with the task unfinished', () => {
    const { result } = renderHook(() => usePracticeSession(1));
    const question = figureQuestions[0]!;

    act(() => {
      result.current.revealAnswer(question.id);
    });

    expect(result.current.isRevealed(question.id)).toBe(true);
    // Nothing was answered, so it does not count towards the attempt tally.
    expect(result.current.progress.answered).toBe(0);
  });
});

describe('isComplete', () => {
  it('requires both images of a figure series', () => {
    const question = figureQuestions[0]!;
    expect(isComplete(question, undefined)).toBe(false);
    expect(isComplete(question, [null, null])).toBe(false);
    expect(isComplete(question, [0, null])).toBe(false);
    expect(isComplete(question, [null, 0])).toBe(false);
    expect(isComplete(question, [0, 0])).toBe(true);
  });

  it('requires every unknown of an equation system', () => {
    const question = test1.sections[1]!.questions[19] as MathEquationsQuestion;
    expect(question.variables).toHaveLength(4);
    expect(isComplete(question, { A: 1, B: 2, C: 3 })).toBe(false);
    expect(isComplete(question, { A: 1, B: 2, C: 3, D: null })).toBe(false);
    expect(isComplete(question, { A: 1, B: 2, C: 3, D: 4 })).toBe(true);
  });

  it('needs one letter for a Latin square', () => {
    const question = latinQuestions[0]!;
    expect(isComplete(question, null)).toBe(false);
    expect(isComplete(question, 'A')).toBe(true);
  });
});
