import { formatDuration, formatPercent, formatPoints } from '@/lib/scoring';
import { Badge, Card, ProgressBar, Stat } from '@/components/ui';
import type { SectionScore, TestScore } from '@/types';

/**
 * Score report: the overall result, the section-wise breakdown, and the
 * correct / incorrect / unanswered tallies with accuracy and time used.
 */

const toneFor = (ratio: number): 'success' | 'warning' | 'danger' =>
  ratio >= 0.75 ? 'success' : ratio >= 0.5 ? 'warning' : 'danger';

const totalFullscreenExits = (score: TestScore): number =>
  score.sections.reduce((total, section) => total + section.fullscreenExits, 0);

const totalCameraInterruptions = (score: TestScore): number =>
  score.sections.reduce((total, section) => total + section.cameraInterruptions, 0);

export function Result({ score }: { score: TestScore }) {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="border-b border-ink-200 bg-gradient-to-r from-brand-700 to-brand-500 px-6 py-5 text-white">
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-100">
            Core Module result
          </p>
          <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-1">
            <p
              className="text-4xl font-bold tabular-nums"
              aria-label={`Total score ${formatPoints(score.points)} of ${score.maxPoints} points`}
            >
              {formatPoints(score.points)}
              <span className="text-xl font-semibold text-brand-100"> / {score.maxPoints}</span>
            </p>
            <p className="text-lg font-semibold text-brand-50">
              {formatPercent(score.percentage)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Correct"
            value={score.correct}
            hint={`of ${score.total} tasks`}
            tone="success"
          />
          <Stat label="Incorrect" value={score.incorrect} hint={`${score.partial} partial`} tone="danger" />
          <Stat label="Unanswered" value={score.unanswered} tone="neutral" />
          <Stat
            label="Accuracy"
            value={formatPercent(score.accuracy)}
            hint="points per attempted task"
            tone="brand"
          />
        </div>

        <div className="border-t border-ink-200 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-600">
            <span>
              Total time used:{' '}
              <strong className="font-semibold text-ink-900 tabular-nums">
                {formatDuration(score.timeUsedMs)}
              </strong>{' '}
              of 75:00
            </span>
            <span className="flex flex-wrap gap-2">
              {score.sections.some((section) => section.autoSubmitted) ? (
                <Badge tone="warning">at least one section was auto-submitted</Badge>
              ) : null}
              {totalFullscreenExits(score) > 0 ? (
                <Badge tone="warning">
                  left fullscreen {totalFullscreenExits(score)}{' '}
                  {totalFullscreenExits(score) === 1 ? 'time' : 'times'}
                </Badge>
              ) : null}
              {totalCameraInterruptions(score) > 0 ? (
                <Badge tone="warning">
                  camera stopped {totalCameraInterruptions(score)}{' '}
                  {totalCameraInterruptions(score) === 1 ? 'time' : 'times'}
                </Badge>
              ) : null}
            </span>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-bold text-ink-900">Section-wise score</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {score.sections.map((section) => (
            <SectionScoreCard key={section.sectionId} section={section} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SectionScoreCard({ section }: { section: SectionScore }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-ink-900">{section.title}</h3>
        <span className="flex shrink-0 flex-wrap justify-end gap-1">
          {section.autoSubmitted ? <Badge tone="warning">auto-submitted</Badge> : null}
          {section.fullscreenExits > 0 ? (
            <Badge tone="warning">{section.fullscreenExits}x left fullscreen</Badge>
          ) : null}
          {section.cameraInterruptions > 0 ? (
            <Badge tone="warning">{section.cameraInterruptions}x camera stopped</Badge>
          ) : null}
        </span>
      </div>

      <p
        className="mt-2 text-3xl font-bold tabular-nums text-ink-900"
        aria-label={`${section.title} score ${formatPoints(section.points)} of ${section.maxPoints} points`}
      >
        {formatPoints(section.points)}
        <span className="text-base font-semibold text-ink-400"> / {section.maxPoints}</span>
      </p>

      <div className="mt-3">
        <ProgressBar value={section.percentage} tone={toneFor(section.percentage)} label="Score" />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-500">Correct</dt>
          <dd className="font-semibold tabular-nums text-emerald-600">{section.correct}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-500">Incorrect</dt>
          <dd className="font-semibold tabular-nums text-red-600">{section.incorrect}</dd>
        </div>
        {section.partial > 0 ? (
          <div className="flex justify-between">
            <dt className="text-ink-500">Partial</dt>
            <dd className="font-semibold tabular-nums text-amber-600">{section.partial}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt className="text-ink-500">Unanswered</dt>
          <dd className="font-semibold tabular-nums text-ink-700">{section.unanswered}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-500">Accuracy</dt>
          <dd className="font-semibold tabular-nums text-ink-900">
            {formatPercent(section.accuracy)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-500">Time used</dt>
          <dd className="font-semibold tabular-nums text-ink-900">
            {formatDuration(section.timeUsedMs)}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
