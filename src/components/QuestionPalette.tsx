import { paletteCounts, type PaletteEntry, type PaletteStatus } from '@/lib/navigation';
import { cx } from '@/components/ui';

/**
 * The navigation palette: one tile per question, colour-coded by state, exactly
 * the four states the brief calls for plus "not visited".
 */

const STATUS_CLASSES: Record<PaletteStatus, string> = {
  'not-visited': 'border-ink-300 bg-white text-ink-600 hover:border-ink-400',
  unanswered: 'border-ink-400 bg-ink-100 text-ink-700 hover:border-ink-500',
  answered: 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600',
  marked: 'border-violet-500 bg-violet-500 text-white hover:bg-violet-600',
  'answered-marked':
    'border-violet-600 bg-gradient-to-br from-emerald-500 to-violet-600 text-white hover:from-emerald-600',
};

const LEGEND: { status: PaletteStatus; label: string }[] = [
  { status: 'answered', label: 'Answered' },
  { status: 'unanswered', label: 'Unanswered' },
  { status: 'marked', label: 'Marked for review' },
  { status: 'answered-marked', label: 'Answered + review' },
  { status: 'not-visited', label: 'Not visited' },
];

const STATUS_TEXT: Record<PaletteStatus, string> = {
  'not-visited': 'not visited',
  unanswered: 'not answered',
  answered: 'answered',
  marked: 'marked for review',
  'answered-marked': 'answered and marked for review',
};

export function QuestionPalette({
  entries,
  current,
  onJump,
  title = 'Questions',
}: {
  entries: PaletteEntry[];
  current: number;
  onJump: (index: number) => void;
  title?: string;
}) {
  const counts = paletteCounts(entries);

  return (
    <nav
      aria-label="Question navigation"
      className="rounded-xl border border-ink-200 bg-white p-4 shadow-card"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-ink-900">{title}</h2>
        <p className="text-xs font-medium text-ink-500 tabular-nums">
          {counts.answered}/{entries.length} answered
        </p>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-2">
        {entries.map((entry) => (
          <button
            key={entry.questionId}
            type="button"
            onClick={() => onJump(entry.index)}
            aria-current={entry.index === current ? 'true' : undefined}
            aria-label={`Question ${entry.index + 1}, ${STATUS_TEXT[entry.status]}`}
            className={cx(
              'relative flex h-9 items-center justify-center rounded-md border-2 text-sm font-bold tabular-nums transition',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
              STATUS_CLASSES[entry.status],
              entry.index === current && 'ring-2 ring-brand-600 ring-offset-1',
            )}
          >
            {entry.index + 1}
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-1.5 border-t border-ink-100 pt-3">
        {LEGEND.map((item) => (
          <li key={item.status} className="flex items-center gap-2 text-xs text-ink-600">
            <span
              className={cx(
                'h-3.5 w-3.5 shrink-0 rounded border-2',
                STATUS_CLASSES[item.status].replace(/hover:[^\s]+/g, ''),
              )}
              aria-hidden="true"
            />
            {item.label}
          </li>
        ))}
      </ul>

      <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-ink-100 pt-3 text-xs">
        <div>
          <dt className="text-ink-500">Answered</dt>
          <dd className="font-bold tabular-nums text-emerald-600">{counts.answered}</dd>
        </div>
        <div>
          <dt className="text-ink-500">Unanswered</dt>
          <dd className="font-bold tabular-nums text-ink-800">{counts.unanswered}</dd>
        </div>
        <div>
          <dt className="text-ink-500">Marked</dt>
          <dd className="font-bold tabular-nums text-violet-600">
            {counts.marked + counts.answeredMarked}
          </dd>
        </div>
        <div>
          <dt className="text-ink-500">Answered + review</dt>
          <dd className="font-bold tabular-nums text-violet-600">{counts.answeredMarked}</dd>
        </div>
      </dl>
    </nav>
  );
}
