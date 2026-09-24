import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTest } from '@/data/questionBank';
import { useFullscreen } from '@/hooks/useFullscreen';
import { ATTEMPTS_KEY, emptyAttempt, loadAttempt } from '@/lib/storage';
import { routes } from '@/routes';
import type { LatinSquaresQuestion, SectionId } from '@/types';

/**
 * jsdom implements no Fullscreen API at all, so these tests install a small fake
 * one. That also lets them cover the branch where the browser has no fullscreen
 * support, which is how the app must behave in an embedded webview.
 */

interface FakeFullscreen {
  enter: () => void;
  leave: () => void;
  requests: number;
  exits: number;
  failNext: boolean;
}

function installFullscreenApi(): FakeFullscreen {
  const state = { element: null as Element | null };
  const fake: FakeFullscreen = {
    requests: 0,
    exits: 0,
    failNext: false,
    enter: () => {
      state.element = document.documentElement;
      document.dispatchEvent(new Event('fullscreenchange'));
    },
    leave: () => {
      state.element = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    },
  };

  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => state.element,
  });
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    writable: true,
    value: async () => {
      fake.exits += 1;
      fake.leave();
    },
  });
  Object.defineProperty(document.documentElement, 'requestFullscreen', {
    configurable: true,
    writable: true,
    value: async () => {
      fake.requests += 1;
      if (fake.failNext) {
        fake.failNext = false;
        throw new Error('Permissions check failed');
      }
      fake.enter();
    },
  });

  return fake;
}

function removeFullscreenApi(): void {
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false });
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
  // @ts-expect-error deliberately removing the API to emulate an old browser
  delete document.exitFullscreen;
  // @ts-expect-error deliberately removing the API to emulate an old browser
  delete document.documentElement.requestFullscreen;
}

const renderApp = (path: string) =>
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

/** Seeds an attempt so a later section is reachable. */
function seedSubmitted(submitted: SectionId[]) {
  const attempt = emptyAttempt(1, Date.now());
  for (const id of submitted) {
    const section = attempt.sections[id]!;
    section.status = 'submitted';
    section.submittedAt = Date.now();
    section.timeUsedMs = 60_000;
  }
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify({ 1: attempt }));
}

let fake: FakeFullscreen;

beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
  fake = installFullscreenApi();
});

afterEach(() => {
  removeFullscreenApi();
  vi.useRealTimers();
});

describe('useFullscreen', () => {
  it('reports support and the current state', () => {
    const { result } = renderHook(() => useFullscreen());
    expect(result.current.supported).toBe(true);
    expect(result.current.isFullscreen).toBe(false);
  });

  it('enters and leaves fullscreen', async () => {
    const { result } = renderHook(() => useFullscreen());

    await act(async () => {
      await result.current.request();
    });
    expect(result.current.isFullscreen).toBe(true);

    await act(async () => {
      await result.current.exit();
    });
    expect(result.current.isFullscreen).toBe(false);
  });

  it('follows a change made outside the app, such as pressing Escape', () => {
    const { result } = renderHook(() => useFullscreen());

    act(() => fake.enter());
    expect(result.current.isFullscreen).toBe(true);

    act(() => fake.leave());
    expect(result.current.isFullscreen).toBe(false);
  });

  it('counts genuine exits and calls onExit', () => {
    const onExit = vi.fn();
    const { result } = renderHook(() => useFullscreen({ onExit }));

    act(() => fake.enter());
    act(() => fake.leave());
    act(() => fake.enter());
    act(() => fake.leave());

    expect(result.current.exitCount).toBe(2);
    expect(onExit).toHaveBeenCalledTimes(2);
  });

  it('does not count a page that merely starts outside fullscreen', () => {
    const onExit = vi.fn();
    const { result } = renderHook(() => useFullscreen({ onExit }));

    // Never entered, so nothing was left.
    expect(result.current.exitCount).toBe(0);
    expect(onExit).not.toHaveBeenCalled();
  });

  it('does not count a deliberate exit through the app', async () => {
    const onExit = vi.fn();
    const { result } = renderHook(() => useFullscreen({ onExit }));

    await act(async () => {
      await result.current.request();
    });
    await act(async () => {
      await result.current.exit();
    });

    expect(result.current.exitCount).toBe(0);
    expect(onExit).not.toHaveBeenCalled();
  });

  it('reports a refused request instead of throwing', async () => {
    const { result } = renderHook(() => useFullscreen());
    fake.failNext = true;

    let granted: boolean | undefined;
    await act(async () => {
      granted = await result.current.request();
    });

    expect(granted).toBe(false);
    expect(result.current.isFullscreen).toBe(false);
    expect(result.current.error).toMatch(/refused/i);
  });

  it('reports no support when the browser has no Fullscreen API', () => {
    removeFullscreenApi();
    const { result } = renderHook(() => useFullscreen());
    expect(result.current.supported).toBe(false);
  });

  it('fails a request gracefully on an unsupported browser', async () => {
    removeFullscreenApi();
    const { result } = renderHook(() => useFullscreen());

    let granted: boolean | undefined;
    await act(async () => {
      granted = await result.current.request();
    });

    expect(granted).toBe(false);
    expect(result.current.error).toMatch(/does not allow fullscreen/i);
  });
});

describe('Test Mode requires fullscreen', () => {
  it('goes fullscreen on the click that starts the clock', async () => {
    const user = userEvent.setup();
    renderApp('/test/1');

    await user.click(screen.getByRole('button', { name: 'Start section' }));
    expect(screen.getByText(/in fullscreen with your camera on/i)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Enable fullscreen and start/i }));

    await waitFor(() => expect(screen.getByText('Time remaining')).toBeTruthy());
    expect(fake.requests).toBe(1);
    expect(document.fullscreenElement).not.toBeNull();
    expect(loadAttempt(1)!.sections['figure-sequences']!.status).toBe('in-progress');
  });

  it('does not start the section if fullscreen is refused', async () => {
    const user = userEvent.setup();
    renderApp('/test/1');

    fake.failNext = true;
    await user.click(screen.getByRole('button', { name: 'Start section' }));
    await user.click(screen.getByRole('button', { name: /Enable fullscreen and start/i }));

    await waitFor(() => {
      expect(screen.getByText(/can only be started in fullscreen/i)).toBeTruthy();
    });
    // The clock never started.
    expect(screen.queryByText('Time remaining')).toBeNull();
    expect(loadAttempt(1)?.sections['figure-sequences']?.status ?? 'not-started').toBe(
      'not-started',
    );
  });

  it('blocks the questions and keeps the clock running when fullscreen is left', async () => {
    const user = userEvent.setup();
    renderApp('/test/1');

    await user.click(screen.getByRole('button', { name: 'Start section' }));
    await user.click(screen.getByRole('button', { name: /Enable fullscreen and start/i }));
    await waitFor(() => expect(screen.getByText('Time remaining')).toBeTruthy());

    // Escape out of fullscreen.
    act(() => fake.leave());

    await waitFor(() => {
      expect(screen.getByRole('alertdialog', { name: /Exam conditions required/i })).toBeTruthy();
    });
    expect(screen.getByRole('heading', { name: 'Return to fullscreen' })).toBeTruthy();
    // The clock is still shown, because it is still running.
    expect(screen.getAllByText('Time remaining').length).toBeGreaterThan(0);
    // The section was not submitted.
    expect(loadAttempt(1)!.sections['figure-sequences']!.status).toBe('in-progress');
  });

  it('records every exit on the attempt, so it survives a refresh', async () => {
    const user = userEvent.setup();
    renderApp('/test/1');

    await user.click(screen.getByRole('button', { name: 'Start section' }));
    await user.click(screen.getByRole('button', { name: /Enable fullscreen and start/i }));
    await waitFor(() => expect(screen.getByText('Time remaining')).toBeTruthy());

    act(() => fake.leave());
    await waitFor(() => {
      expect(loadAttempt(1)!.sections['figure-sequences']!.fullscreenExits).toBe(1);
    });

    await user.click(screen.getByRole('button', { name: 'Return to fullscreen' }));
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    act(() => fake.leave());
    await waitFor(() => {
      expect(loadAttempt(1)!.sections['figure-sequences']!.fullscreenExits).toBe(2);
    });
  });

  it('lets the test taker submit from the gate instead of returning', async () => {
    const user = userEvent.setup();
    seedSubmitted(['figure-sequences', 'mathematical-equations']);
    renderApp('/test/1');

    await user.click(screen.getByRole('button', { name: 'Start section' }));
    await user.click(screen.getByRole('button', { name: /Enable fullscreen and start/i }));
    await waitFor(() => expect(screen.getByText('Time remaining')).toBeTruthy());

    act(() => fake.leave());
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeNull());

    await user.click(screen.getByRole('button', { name: /Submit the section instead/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Section submitted' })).toBeTruthy();
    });
    expect(loadAttempt(1)!.sections['latin-squares']!.status).toBe('submitted');
  });

  it('leaves fullscreen when the section is left', async () => {
    const user = userEvent.setup();
    seedSubmitted(['figure-sequences', 'mathematical-equations']);
    const latin = getTest(1)!.sections[2]!.questions[0] as LatinSquaresQuestion;

    renderApp('/test/1');
    await user.click(screen.getByRole('button', { name: 'Start section' }));
    await user.click(screen.getByRole('button', { name: /Enable fullscreen and start/i }));
    await waitFor(() => expect(screen.getByText('Time remaining')).toBeTruthy());

    await user.click(screen.getByRole('button', { name: latin.answer }));
    await user.click(screen.getAllByRole('button', { name: 'Submit section' })[0]!);
    await user.click(screen.getByRole('button', { name: /Submit and lock/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Section submitted' })).toBeTruthy(),
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(document.fullscreenElement).toBeNull());
    expect(fake.exits).toBeGreaterThan(0);
  });

  it('reports the exits on the result page', async () => {
    const attempt = emptyAttempt(1, Date.now());
    for (const section of getTest(1)!.sections) {
      const record = attempt.sections[section.id]!;
      record.status = 'submitted';
      record.submittedAt = Date.now();
      record.timeUsedMs = 60_000;
    }
    attempt.sections['figure-sequences']!.fullscreenExits = 3;
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify({ 1: attempt }));

    renderApp('/test/1/result');

    expect(screen.getByText(/left fullscreen 3 times/i)).toBeTruthy();
    expect(screen.getByText(/3x left fullscreen/i)).toBeTruthy();
  });

  it('still runs the test when the browser has no fullscreen support', async () => {
    removeFullscreenApi();
    const user = userEvent.setup();
    renderApp('/test/1');

    await user.click(screen.getByRole('button', { name: 'Start section' }));
    expect(
      screen.getByText(/offers neither fullscreen nor camera access/i),
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Start the 25-minute clock/i }));

    await waitFor(() => expect(screen.getByText('Time remaining')).toBeTruthy());
    // No gate appears, because there is nothing to enforce.
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('Practice Mode leaves fullscreen to the user', () => {
  it('offers a toggle and never blocks the questions', async () => {
    const user = userEvent.setup();
    renderApp('/practice/1');

    // Practice works straight away, outside fullscreen.
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByText('Not answered yet')).toBeTruthy();

    const toggle = screen.getByRole('button', { name: 'Fullscreen' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    await user.click(toggle);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeTruthy();
    });
    expect(document.fullscreenElement).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Exit fullscreen' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Fullscreen' })).toBeTruthy();
    });
  });

  it('keeps practising when fullscreen is left, with no gate', async () => {
    const user = userEvent.setup();
    renderApp('/practice/1');

    await user.click(screen.getByRole('button', { name: 'Fullscreen' }));
    await waitFor(() => expect(document.fullscreenElement).not.toBeNull());

    act(() => fake.leave());

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByText('Not answered yet')).toBeTruthy();
  });

  it('hides the toggle when the browser has no fullscreen support', () => {
    removeFullscreenApi();
    renderApp('/practice/1');

    expect(screen.queryByRole('button', { name: 'Fullscreen' })).toBeNull();
    expect(screen.getByText(/does not allow web pages to go fullscreen/i)).toBeTruthy();
  });
});
