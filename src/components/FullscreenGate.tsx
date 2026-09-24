import { Badge, Button, Card, cx } from '@/components/ui';
import type { FullscreenController } from '@/hooks/useFullscreen';

/**
 * The fullscreen pre-flight check on the Test Mode landing screen, and the
 * opt-in toggle in Practice Mode. The blocking overlay for a running section
 * lives in `ExamGate`.
 */

export function FullscreenStatus({
  fullscreen,
  required,
  className,
}: {
  fullscreen: FullscreenController;
  /** True in Test Mode, where fullscreen is a condition for starting. */
  required: boolean;
  className?: string;
}) {
  const { isFullscreen, supported, error, request, exit } = fullscreen;

  return (
    <Card className={cx('p-4', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink-900">Fullscreen</h3>
        {!supported ? (
          <Badge tone="neutral">Unavailable</Badge>
        ) : isFullscreen ? (
          <Badge tone="success">On</Badge>
        ) : required ? (
          <Badge tone="warning">Required</Badge>
        ) : (
          <Badge tone="neutral">Off</Badge>
        )}
      </div>

      <p className="text-xs leading-snug text-ink-600">
        {!supported
          ? 'This browser does not allow web pages to go fullscreen, so the test runs in a normal window.'
          : required
            ? 'Every subtest runs in fullscreen. Leaving fullscreen hides the questions until you return — and the clock keeps running.'
            : 'Optional here. Fullscreen removes the browser chrome so practice feels closer to the real exam.'}
      </p>

      {error ? <p className="mt-2 text-xs text-amber-700">{error}</p> : null}

      {supported ? (
        <div className="mt-3">
          {isFullscreen ? (
            <Button variant="outline" size="sm" onClick={() => void exit()}>
              Leave fullscreen
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => void request()}>
              Enter fullscreen
            </Button>
          )}
        </div>
      ) : null}
    </Card>
  );
}
