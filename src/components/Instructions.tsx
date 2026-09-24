import { QUESTIONS_PER_SECTION, SECTION_DURATION_MS, type SectionSpec } from '@/data/examSpec';
import { formatDuration } from '@/lib/scoring';
import { Badge, Card } from '@/components/ui';

/**
 * Instruction blocks.
 *
 * `Instructions` shows the generic list used on the Test Mode landing screen;
 * `SectionInstructions` shows the full instruction text plus the rule list of
 * one subtest, which is what the test taker reads before starting the clock.
 */

export function Instructions({
  title,
  paragraphs,
  footnote,
}: {
  title: string;
  paragraphs: string[];
  footnote?: string;
}) {
  return (
    <Card className="p-5">
      <h2 className="text-lg font-bold text-ink-900">{title}</h2>
      <ol className="mt-3 space-y-2.5">
        {paragraphs.map((paragraph, index) => (
          <li key={index} className="flex gap-3 text-sm leading-relaxed text-ink-700">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <span>{paragraph}</span>
          </li>
        ))}
      </ol>
      {footnote ? <p className="mt-4 text-xs text-ink-500">{footnote}</p> : null}
    </Card>
  );
}

export function SectionInstructions({ spec }: { spec: SectionSpec }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-brand-700 px-5 py-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-100">
            Core Module · Section {spec.order}
          </p>
          <h2 className="text-lg font-bold text-white">{spec.title}</h2>
        </div>
        <div className="flex gap-2">
          <Badge tone="brand" className="bg-white/90">
            {QUESTIONS_PER_SECTION} tasks
          </Badge>
          <Badge tone="brand" className="bg-white/90">
            {formatDuration(SECTION_DURATION_MS)} min
          </Badge>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-ink-500">Instructions</h3>
          <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-700">
            {spec.instructions.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-ink-500">Rules</h3>
          <ul className="mt-2 space-y-1.5">
            {spec.rules.map((rule, index) => (
              <li key={index} className="flex gap-2 text-sm text-ink-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="rounded-lg bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800">
          {spec.answerHint}
        </p>
      </div>
    </Card>
  );
}
