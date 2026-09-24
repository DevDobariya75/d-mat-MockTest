import { Button } from '@/components/ui';
import { Timer } from '@/components/Timer';

/**
 * The blocking overlay that covers a running section whenever an exam condition
 * is not met — fullscreen left, or the camera off.
 *
 * The countdown stays visible on purpose: in a real exam the clock does not stop
 * because you left the window or covered the lens, and hiding it would make the
 * overlay feel like a pause. Each fix needs a click, because browsers only grant
 * fullscreen and camera access from inside a user gesture.
 */

export interface GateRequirement {
  key: string;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  error?: string | null;
  /** Shown once the condition has been broken more than once. */
  note?: string | null;
}

export function ExamGate({
  requirements,
  remainingMs,
  onSubmit,
}: {
  requirements: GateRequirement[];
  remainingMs: number;
  /** Lets the test taker end the section rather than fix the condition. */
  onSubmit: () => void;
}) {
  if (requirements.length === 0) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Exam conditions required"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/95 p-4 backdrop-blur"
    >
      <div className="w-full max-w-md rounded-xl border border-ink-700 bg-ink-800 p-6 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 text-2xl">
          <span aria-hidden="true">!</span>
        </div>

        <h2 className="text-lg font-bold text-white">Exam conditions not met</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-200">
          Your answers are safe, but the questions stay hidden until every condition is met
          again — <strong className="text-white">and the clock is still running.</strong>
        </p>

        <div className="mt-4 flex justify-center">
          <Timer remainingMs={remainingMs} label="Time remaining" />
        </div>

        <ul className="mt-5 space-y-3 text-left">
          {requirements.map((requirement) => (
            <li
              key={requirement.key}
              className="rounded-lg border border-ink-700 bg-ink-900/60 p-3"
            >
              <h3 className="text-sm font-semibold text-white">{requirement.title}</h3>
              <p className="mt-0.5 text-xs leading-snug text-ink-300">
                {requirement.description}
              </p>
              {requirement.error ? (
                <p className="mt-1 text-xs text-amber-300">{requirement.error}</p>
              ) : null}
              {requirement.note ? (
                <p className="mt-1 text-xs text-amber-300">{requirement.note}</p>
              ) : null}
              <Button
                variant="primary"
                size="sm"
                className="mt-2 w-full"
                onClick={requirement.onAction}
              >
                {requirement.actionLabel}
              </Button>
            </li>
          ))}
        </ul>

        <Button variant="ghost" size="sm" className="mt-4 text-ink-300" onClick={onSubmit}>
          Submit the section instead
        </Button>
      </div>
    </div>
  );
}
