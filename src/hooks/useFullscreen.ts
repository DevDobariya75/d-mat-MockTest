import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Wrapper around the Fullscreen API.
 *
 * Browsers only grant fullscreen from inside a user gesture, so `request` must
 * be called straight from a click handler — never from an effect.
 *
 * Vendor prefixes are still needed for Safari, which exposes the WebKit names.
 */

type PrefixedDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type PrefixedElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export interface FullscreenController {
  /** True while the document is displayed fullscreen. */
  isFullscreen: boolean;
  /** False when the browser cannot go fullscreen at all (or is blocked by policy). */
  supported: boolean;
  /** Message from the last failed request, if any. */
  error: string | null;
  /** Requests fullscreen. Resolves to whether it was granted. Needs a user gesture. */
  request: () => Promise<boolean>;
  /** Leaves fullscreen. Safe to call when not fullscreen. */
  exit: () => Promise<void>;
  /** Number of times fullscreen was left since this controller was mounted. */
  exitCount: number;
}

const fullscreenElement = (): Element | null => {
  if (typeof document === 'undefined') return null;
  const doc = document as PrefixedDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
};

const fullscreenSupported = (): boolean => {
  if (typeof document === 'undefined') return false;
  const doc = document as PrefixedDocument;
  const element = document.documentElement as PrefixedElement;
  const enabled = doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? false;
  const requestable =
    typeof element.requestFullscreen === 'function' ||
    typeof element.webkitRequestFullscreen === 'function';
  return enabled && requestable;
};

export function useFullscreen(
  options: { onExit?: () => void } = {},
): FullscreenController {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => fullscreenElement() !== null);
  const [supported] = useState<boolean>(() => fullscreenSupported());
  const [error, setError] = useState<string | null>(null);
  const [exitCount, setExitCount] = useState(0);

  const wasFullscreen = useRef(isFullscreen);
  const onExitRef = useRef(options.onExit);
  onExitRef.current = options.onExit;

  useEffect(() => {
    const sync = () => {
      const active = fullscreenElement() !== null;
      setIsFullscreen(active);
      // Only a genuine transition out counts, so a page that simply loads
      // outside fullscreen is not reported as having left it.
      if (wasFullscreen.current && !active) {
        setExitCount((count) => count + 1);
        onExitRef.current?.();
      }
      wasFullscreen.current = active;
    };

    const onError = () => setError('The browser refused to switch to fullscreen.');

    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    document.addEventListener('fullscreenerror', onError);
    document.addEventListener('webkitfullscreenerror', onError);
    sync();

    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
      document.removeEventListener('fullscreenerror', onError);
      document.removeEventListener('webkitfullscreenerror', onError);
    };
  }, []);

  const request = useCallback(async (): Promise<boolean> => {
    if (fullscreenElement() !== null) return true;
    if (!supported) {
      setError('This browser does not allow fullscreen for web pages.');
      return false;
    }

    const element = document.documentElement as PrefixedElement;
    const invoke = element.requestFullscreen ?? element.webkitRequestFullscreen;
    if (!invoke) {
      setError('This browser does not allow fullscreen for web pages.');
      return false;
    }

    try {
      await invoke.call(element);
      setError(null);
      // Safari resolves before the change event fires, so read the state back.
      const active = fullscreenElement() !== null;
      if (active) {
        wasFullscreen.current = true;
        setIsFullscreen(true);
      }
      return active;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Fullscreen was refused: ${cause.message}`
          : 'Fullscreen was refused by the browser.',
      );
      return false;
    }
  }, [supported]);

  const exit = useCallback(async (): Promise<void> => {
    if (fullscreenElement() === null) return;
    const doc = document as PrefixedDocument;
    const invoke = doc.exitFullscreen ?? doc.webkitExitFullscreen;
    if (!invoke) return;
    try {
      // Leaving on purpose is not a violation.
      wasFullscreen.current = false;
      await invoke.call(doc);
    } catch {
      // Nothing to do: the document simply stays fullscreen.
    }
  }, []);

  return { isFullscreen, supported, error, request, exit, exitCount };
}
