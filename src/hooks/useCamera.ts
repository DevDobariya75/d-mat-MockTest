import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Local-only camera preview.
 *
 * The stream is attached to a <video> element for realism and nothing else:
 * no MediaRecorder, no canvas capture, no network request. Stopping the preview
 * releases every track, which turns the hardware indicator off.
 *
 * Test Mode requires the camera, so the hook also notices when a live stream
 * dies — permission revoked from the browser UI, the device unplugged, or
 * another application taking it over — and reports that as an interruption.
 */

export type CameraStatus =
  | 'idle'
  | 'requesting'
  | 'live'
  | 'denied'
  | 'unsupported'
  | 'error'
  /** Was live, then the stream ended on its own. */
  | 'interrupted';

export interface CameraController {
  status: CameraStatus;
  error: string | null;
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Requests the camera. Resolves to whether a live preview was obtained. */
  start: () => Promise<boolean>;
  stop: () => void;
  supported: boolean;
  /** How many times a live stream was lost since this controller was mounted. */
  interruptions: number;
}

export function useCamera(
  options: { onInterrupt?: () => void } = {},
): CameraController {
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [interruptions, setInterruptions] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const onInterruptRef = useRef(options.onInterrupt);
  onInterruptRef.current = options.onInterrupt;

  const supported =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function';

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stop = useCallback(() => {
    // Calling `track.stop()` never fires `ended`, so a deliberate stop is not
    // mistaken for an interruption.
    release();
    setStatus('idle');
  }, [release]);

  const start = useCallback(async (): Promise<boolean> => {
    if (!supported) {
      setStatus('unsupported');
      setError('This browser does not expose a camera to web pages.');
      return false;
    }
    if (streamRef.current) return true;

    setStatus('requesting');
    setError(null);
    try {
      // Video only: audio is never requested, so no microphone access is asked for.
      const next = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });

      // Notice a stream that dies on its own.
      for (const track of next.getTracks()) {
        track.addEventListener('ended', () => {
          if (streamRef.current !== next) return; // already replaced or released
          release();
          setStatus('interrupted');
          setError('The camera stopped. Turn it back on to continue.');
          setInterruptions((count) => count + 1);
          onInterruptRef.current?.();
        });
      }

      streamRef.current = next;
      setStream(next);
      if (videoRef.current) {
        videoRef.current.srcObject = next;
        await videoRef.current.play().catch(() => undefined);
      }
      setStatus('live');
      return true;
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setStatus('denied');
        setError('Camera permission was declined.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setStatus('error');
        setError('No camera was found on this device.');
      } else if (name === 'NotReadableError') {
        setStatus('error');
        setError('The camera is in use by another application.');
      } else {
        setStatus('error');
        setError(cause instanceof Error ? cause.message : 'The camera could not be started.');
      }
      return false;
    }
  }, [release, supported]);

  // Re-attach if the video element mounts after the stream was acquired.
  useEffect(() => {
    if (stream && videoRef.current && videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [stream]);

  // Always release the hardware when the owning screen unmounts.
  useEffect(() => release, [release]);

  return { status, error, stream, videoRef, start, stop, supported, interruptions };
}
