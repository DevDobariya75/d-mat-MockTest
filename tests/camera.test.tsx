import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTest } from '@/data/questionBank';
import { useCamera } from '@/hooks/useCamera';
import { ATTEMPTS_KEY, emptyAttempt, loadAttempt } from '@/lib/storage';
import { routes } from '@/routes';
import type { LatinSquaresQuestion, SectionId } from '@/types';

/**
 * jsdom has no `getUserMedia` and no `MediaStream`, so these tests install a
 * fake camera. It can be granted, denied, absent, or it can die mid-section the
 * way a revoked permission or an unplugged webcam does.
 */

class FakeTrack extends EventTarget {
  kind = 'video';
  readyState: 'live' | 'ended' = 'live';
  stopped = false;

  stop() {
    this.stopped = true;
    this.readyState = 'ended';
    // Per spec, stop() does not fire `ended` — only an external end does.
  }

  /** Simulates the browser or the OS ending the track. */
  die() {
    this.readyState = 'ended';
    this.dispatchEvent(new Event('ended'));
  }
}

class FakeStream {
  private readonly tracks: FakeTrack[];
  constructor(tracks: FakeTrack[]) {
    this.tracks = tracks;
  }
  getTracks() {
    return this.tracks;
  }
  getVideoTracks() {
    return this.tracks;
  }
}

interface FakeCamera {
  granted: number;
  /** Set to a DOMException name to make the next request fail. */
  failWith: string | null;
  lastTrack: FakeTrack | null;
  /** Ends the live stream, as a revoked permission would. */
  die: () => void;
}

function installCameraApi(): FakeCamera {
  const fake: FakeCamera = {
    granted: 0,
    failWith: null,
    lastTrack: null,
    die: () => fake.lastTrack?.die(),
  };

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async () => {
        if (fake.failWith) {
          const name = fake.failWith;
          fake.failWith = null;
          throw new DOMException('camera unavailable', name);
        }
        fake.granted += 1;
        const track = new FakeTrack();
        fake.lastTrack = track;
        return new FakeStream([track]) as unknown as MediaStream;
      },
    },
  });

  // jsdom's <video> has no play() and cannot take a MediaStream.
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    writable: true,
    value: async () => undefined,
  });

  return fake;
}

function removeCameraApi(): void {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
}

/** Grants fullscreen automatically so only the camera is under test. */
function installFullscreenApi(): void {
  const state = { element: null as Element | null };
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => state.element,
  });
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    writable: true,
    value: async () => {
      state.element = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    },
  });
  Object.defineProperty(document.documentElement, 'requestFullscreen', {
    configurable: true,
    writable: true,
    value: async () => {
      state.element = document.documentElement;
      document.dispatchEvent(new Event('fullscreenchange'));
    },
  });
}

function removeFullscreenApi(): void {
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false });
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
  // @ts-expect-error emulating a browser without the API
  delete document.exitFullscreen;
  // @ts-expect-error emulating a browser without the API
  delete document.documentElement.requestFullscreen;
}

const renderApp = (path: string) =>
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

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

/** Starts the third section, so only two clicks stand between us and questions. */
async function startLatinSquares(user: ReturnType<typeof userEvent.setup>) {
  seedSubmitted(['figure-sequences', 'mathematical-equations']);
  renderApp('/test/1');
  await user.click(screen.getByRole('button', { name: 'Start section' }));
  await user.click(screen.getByRole('button', { name: /and start/i }));
  await waitFor(() => expect(screen.getByText('Time remaining')).toBeTruthy());
}

let camera: FakeCamera;

beforeEach(() => {
  camera = installCameraApi();
  installFullscreenApi();
});

afterEach(() => {
  removeCameraApi();
  removeFullscreenApi();
  vi.useRealTimers();
});

describe('useCamera', () => {
  it('reports support and starts idle', () => {
    const { result } = renderHook(() => useCamera());
    expect(result.current.supported).toBe(true);
    expect(result.current.status).toBe('idle');
  });

  it('goes live and reports success', async () => {
    const { result } = renderHook(() => useCamera());

    let live: boolean | undefined;
    await act(async () => {
      live = await result.current.start();
    });

    expect(live).toBe(true);
    expect(result.current.status).toBe('live');
    expect(camera.granted).toBe(1);
  });

  it('reports a denied permission without throwing', async () => {
    const { result } = renderHook(() => useCamera());
    camera.failWith = 'NotAllowedError';

    let live: boolean | undefined;
    await act(async () => {
      live = await result.current.start();
    });

    expect(live).toBe(false);
    expect(result.current.status).toBe('denied');
    expect(result.current.error).toMatch(/declined/i);
  });

  it('reports a missing device', async () => {
    const { result } = renderHook(() => useCamera());
    camera.failWith = 'NotFoundError';

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toMatch(/No camera was found/i);
  });

  it('reports a camera held by another application', async () => {
    const { result } = renderHook(() => useCamera());
    camera.failWith = 'NotReadableError';

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.error).toMatch(/in use by another application/i);
  });

  it('notices a stream that dies on its own, and counts it', async () => {
    const onInterrupt = vi.fn();
    const { result } = renderHook(() => useCamera({ onInterrupt }));

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('live');

    act(() => camera.die());

    expect(result.current.status).toBe('interrupted');
    expect(result.current.interruptions).toBe(1);
    expect(onInterrupt).toHaveBeenCalledTimes(1);
  });

  it('can be restarted after an interruption', async () => {
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });
    act(() => camera.die());
    expect(result.current.status).toBe('interrupted');

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('live');
    expect(camera.granted).toBe(2);
  });

  it('does not count a deliberate stop as an interruption', async () => {
    const onInterrupt = vi.fn();
    const { result } = renderHook(() => useCamera({ onInterrupt }));

    await act(async () => {
      await result.current.start();
    });
    act(() => result.current.stop());

    expect(result.current.status).toBe('idle');
    expect(result.current.interruptions).toBe(0);
    expect(onInterrupt).not.toHaveBeenCalled();
  });

  it('releases the hardware when the owner unmounts', async () => {
    const { result, unmount } = renderHook(() => useCamera());
    await act(async () => {
      await result.current.start();
    });
    const track = camera.lastTrack!;

    unmount();

    expect(track.stopped).toBe(true);
  });

  it('reports no support when the browser exposes no camera', async () => {
    removeCameraApi();
    const { result } = renderHook(() => useCamera());
    expect(result.current.supported).toBe(false);

    let live: boolean | undefined;
    await act(async () => {
      live = await result.current.start();
    });
    expect(live).toBe(false);
    expect(result.current.status).toBe('unsupported');
  });
});

describe('Test Mode requires the camera', () => {
  it('turns the camera on with the click that starts the clock', async () => {
    const user = userEvent.setup();
    renderApp('/test/1');

    await user.click(screen.getByRole('button', { name: 'Start section' }));
    expect(screen.getByText(/in fullscreen with your camera on/i)).toBeTruthy();

    await user.click(
      screen.getByRole('button', { name: /Enable fullscreen \+ camera and start/i }),
    );

    await waitFor(() => expect(screen.getByText('Time remaining')).toBeTruthy());
    // The running section acquires its own stream, so the badge flips a tick later.
    await waitFor(() => expect(screen.getByText('Camera on')).toBeTruthy());
    expect(camera.granted).toBeGreaterThan(0);
    expect(loadAttempt(1)!.sections['figure-sequences']!.status).toBe('in-progress');
  });

  it('does not start the section if camera permission is denied', async () => {
    const user = userEvent.setup();
    renderApp('/test/1');

    camera.failWith = 'NotAllowedError';
    await user.click(screen.getByRole('button', { name: 'Start section' }));
    await user.click(screen.getByRole('button', { name: /and start/i }));

    await waitFor(() => {
      expect(screen.getByText(/can only be started with the camera on/i)).toBeTruthy();
    });
    expect(screen.queryByText('Time remaining')).toBeNull();
    expect(loadAttempt(1)?.sections['figure-sequences']?.status ?? 'not-started').toBe(
      'not-started',
    );
  });

  it('does not start the section when the device has no camera', async () => {
    const user = userEvent.setup();
    renderApp('/test/1');

    camera.failWith = 'NotFoundError';
    await user.click(screen.getByRole('button', { name: 'Start section' }));
    await user.click(screen.getByRole('button', { name: /and start/i }));

    await waitFor(() => {
      expect(screen.getByText(/can only be started with the camera on/i)).toBeTruthy();
    });
    expect(screen.queryByText('Time remaining')).toBeNull();
  });

  it('blocks the questions and keeps the clock running when the camera stops', async () => {
    const user = userEvent.setup();
    await startLatinSquares(user);

    act(() => camera.die());

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeTruthy();
    });
    expect(screen.getByRole('heading', { name: 'Switch the camera back on' })).toBeTruthy();
    // The clock is still shown, because it is still running.
    expect(screen.getAllByText('Time remaining').length).toBeGreaterThan(0);
    expect(loadAttempt(1)!.sections['latin-squares']!.status).toBe('in-progress');
  });

  it('records every camera interruption on the attempt', async () => {
    const user = userEvent.setup();
    await startLatinSquares(user);

    act(() => camera.die());
    await waitFor(() => {
      expect(loadAttempt(1)!.sections['latin-squares']!.cameraInterruptions).toBe(1);
    });

    await user.click(screen.getByRole('button', { name: /Turn the camera on/i }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());

    act(() => camera.die());
    await waitFor(() => {
      expect(loadAttempt(1)!.sections['latin-squares']!.cameraInterruptions).toBe(2);
    });
  });

  it('lifts the gate once the camera is back', async () => {
    const user = userEvent.setup();
    await startLatinSquares(user);

    act(() => camera.die());
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeNull());

    await user.click(screen.getByRole('button', { name: /Turn the camera on/i }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByText('Camera on')).toBeTruthy();
    expect(screen.getByText('Question 1')).toBeTruthy();
  });

  it('lists both conditions when fullscreen and the camera are lost together', async () => {
    const user = userEvent.setup();
    await startLatinSquares(user);

    await act(async () => {
      camera.die();
      await document.exitFullscreen();
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Exam conditions not met' })).toBeTruthy();
    });
    expect(screen.getByRole('heading', { name: 'Return to fullscreen' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Switch the camera back on' })).toBeTruthy();
  });

  it('lets the test taker submit from the gate instead of fixing the camera', async () => {
    const user = userEvent.setup();
    await startLatinSquares(user);

    act(() => camera.die());
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeNull());

    await user.click(screen.getByRole('button', { name: /Submit the section instead/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Section submitted' })).toBeTruthy();
    });
    expect(loadAttempt(1)!.sections['latin-squares']!.status).toBe('submitted');
  });

  it('offers no way to switch a required camera off', async () => {
    const user = userEvent.setup();
    await startLatinSquares(user);

    expect(screen.queryByRole('button', { name: 'Turn off' })).toBeNull();
    expect(screen.getByText(/must stay on for the whole subtest/i)).toBeTruthy();
  });

  it('releases the camera when the section is left', async () => {
    const user = userEvent.setup();
    const latin = getTest(1)!.sections[2]!.questions[0] as LatinSquaresQuestion;
    await startLatinSquares(user);

    const track = camera.lastTrack!;
    await user.click(screen.getByRole('button', { name: latin.answer }));
    await user.click(screen.getAllByRole('button', { name: 'Submit section' })[0]!);
    await user.click(screen.getByRole('button', { name: /Submit and lock/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Section submitted' })).toBeTruthy(),
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(track.stopped).toBe(true));
  });

  it('reports camera interruptions on the result page', () => {
    const attempt = emptyAttempt(1, Date.now());
    for (const section of getTest(1)!.sections) {
      const record = attempt.sections[section.id]!;
      record.status = 'submitted';
      record.submittedAt = Date.now();
      record.timeUsedMs = 60_000;
    }
    attempt.sections['latin-squares']!.cameraInterruptions = 2;
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify({ 1: attempt }));

    renderApp('/test/1/result');

    expect(screen.getByText(/camera stopped 2 times/i)).toBeTruthy();
    expect(screen.getByText(/2x camera stopped/i)).toBeTruthy();
  });

  it('still runs the test when the browser exposes no camera at all', async () => {
    removeCameraApi();
    const user = userEvent.setup();
    renderApp('/test/1');

    await user.click(screen.getByRole('button', { name: 'Start section' }));
    expect(screen.getByText(/does not expose a camera/i)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Enable fullscreen and start/i }));

    await waitFor(() => expect(screen.getByText('Time remaining')).toBeTruthy());
    // Nothing to enforce, so no gate.
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('Practice Mode does not require the camera', () => {
  it('shows no camera requirement and no gate', () => {
    renderApp('/practice/1');

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByText('Camera required')).toBeNull();
    expect(screen.getByText('Not answered yet')).toBeTruthy();
  });
});
