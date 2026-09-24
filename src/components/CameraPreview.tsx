import { Badge, Button, cx } from '@/components/ui';
import type { CameraController } from '@/hooks/useCamera';

/**
 * Local camera preview for exam realism.
 *
 * The stream is only ever attached to the <video> element below. Nothing is
 * recorded, stored or uploaded — there is no MediaRecorder, no canvas capture
 * and no network call anywhere in this component or in `useCamera`.
 */

export function CameraPreview({
  camera,
  size = 'md',
  showControls = true,
  required = false,
  className,
}: {
  camera: CameraController;
  size?: 'sm' | 'md';
  showControls?: boolean;
  /** True in Test Mode, where the camera must stay on for the whole subtest. */
  required?: boolean;
  className?: string;
}) {
  const { status, error, videoRef, start, stop, supported } = camera;
  const frame = size === 'sm' ? 'aspect-[4/3] w-40' : 'aspect-[4/3] w-full max-w-xs';

  return (
    <div
      className={cx('rounded-xl border border-ink-200 bg-white p-3 shadow-card', className)}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink-900">Camera</h3>
        {status === 'live' ? (
          <Badge tone="success">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            Preview on
          </Badge>
        ) : status === 'requesting' ? (
          <Badge tone="info">Requesting…</Badge>
        ) : status === 'denied' ? (
          <Badge tone="warning">Permission denied</Badge>
        ) : status === 'interrupted' ? (
          <Badge tone="danger">Stopped</Badge>
        ) : status === 'unsupported' || !supported ? (
          <Badge tone="neutral">Unavailable</Badge>
        ) : status === 'error' ? (
          <Badge tone="danger">Error</Badge>
        ) : required ? (
          <Badge tone="warning">Required</Badge>
        ) : (
          <Badge tone="neutral">Off</Badge>
        )}
      </div>

      <div
        className={cx(
          'relative overflow-hidden rounded-lg border border-ink-200 bg-ink-900',
          frame,
        )}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          aria-label="Local camera preview"
          className={cx(
            'h-full w-full scale-x-[-1] object-cover',
            status === 'live' ? 'opacity-100' : 'opacity-0',
          )}
        />
        {status !== 'live' ? (
          <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-ink-300">
            {status === 'requesting'
              ? 'Waiting for camera permission…'
              : status === 'denied'
                ? required
                  ? 'Camera permission is required to take the test.'
                  : 'Camera off — the test runs without it.'
                : status === 'interrupted'
                  ? 'The camera stopped.'
                  : !supported
                    ? 'No camera available in this browser.'
                    : 'Camera preview is off.'}
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-xs text-amber-700">{error}</p> : null}

      <p className="mt-2 text-[11px] leading-snug text-ink-500">
        {required
          ? 'The camera must stay on for the whole subtest. The preview stays on your device — nothing is recorded, stored or uploaded.'
          : 'The preview stays on your device. Nothing is recorded, stored or uploaded.'}
      </p>

      {showControls ? (
        <div className="mt-2 flex gap-2">
          {status === 'live' ? (
            // A required camera offers no off switch.
            required ? null : (
              <Button variant="outline" size="sm" onClick={stop}>
                Turn off
              </Button>
            )
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void start()}
              disabled={!supported || status === 'requesting'}
            >
              {status === 'denied' || status === 'interrupted' ? 'Try again' : 'Turn on camera'}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
