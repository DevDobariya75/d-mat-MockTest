import { useEffect, useMemo, useState } from 'react';

import { QUESTIONS_PER_SECTION, SECTION_SPECS } from '@/data/examSpec';
import { mockTests, totalQuestionCount } from '@/data/questionBank';
import { formatPercent, formatPoints, scoreTest } from '@/lib/scoring';
import {
  isTestComplete,
  runningSectionId,
  submittedSectionCount,
} from '@/lib/sessionRules';
import { loadAttempts } from '@/lib/storage';
import { Badge, Card, LinkButton, ProgressBar, SectionHeading } from '@/components/ui';
import type { TestAttempt } from '@/types';

/**
 * Landing page: the ten mock tests, each with a Test Mode and a Practice Mode
 * entry point, plus whatever progress has already been stored locally.
 */

export function HomePage() {
  const [attempts, setAttempts] = useState<Record<string, TestAttempt>>({});

  useEffect(() => {
    setAttempts(loadAttempts());
  }, []);

  const completed = useMemo(
    () => mockTests.filter((test) => isTestComplete(attempts[String(test.id)] ?? null)).length,
    [attempts],
  );

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="dMAT · Digital Master Assessment Test"
        title="Core Module mock tests"
        description={
          <>
            Ten full-length mock tests for the dMAT Core Module. Each test has three subtests —{' '}
            {SECTION_SPECS.map((spec) => spec.title).join(', ')} — with {QUESTIONS_PER_SECTION}{' '}
            tasks and 25 minutes each: 60 tasks in 75 minutes. All {totalQuestionCount} questions
            are original, with a verified answer and a solution path.
          </>
        }
        actions={
          <Badge tone="brand">
            {completed} / {mockTests.length} tests completed
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {mockTests.map((test) => (
          <TestCard key={test.id} testId={test.id} attempt={attempts[String(test.id)] ?? null} />
        ))}
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-bold text-ink-900">How the two modes differ</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-brand-700">Test Mode</h3>
            <ul className="mt-1.5 space-y-1 text-sm text-ink-600">
              <li>· Instructions, then an optional camera check</li>
              <li>· One 25-minute countdown per subtest</li>
              <li>· A started subtest cannot be left, paused or restarted</li>
              <li>· Auto-submits at zero; completed subtests are locked</li>
              <li>· Unlimited time between subtests</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-brand-700">Practice Mode</h3>
            <ul className="mt-1.5 space-y-1 text-sm text-ink-600">
              <li>· No timer, no section order</li>
              <li>· Immediate correct/incorrect feedback</li>
              <li>· Correct answer and solution path on every task</li>
              <li>· Free navigation and unlimited retries</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TestCard({ testId, attempt }: { testId: number; attempt: TestAttempt | null }) {
  const test = mockTests.find((candidate) => candidate.id === testId);
  if (!test) return null;

  const done = submittedSectionCount(attempt);
  const complete = isTestComplete(attempt);
  const running = runningSectionId(attempt);
  const score = complete && attempt ? scoreTest(test, attempt) : null;

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
            Core Module
          </p>
          <h2 className="text-lg font-bold text-ink-900">{test.title}</h2>
        </div>
        {complete ? (
          <Badge tone="success">Completed</Badge>
        ) : running ? (
          <Badge tone="danger">In progress</Badge>
        ) : done > 0 ? (
          <Badge tone="warning">{done}/3 done</Badge>
        ) : (
          <Badge tone="neutral">Not started</Badge>
        )}
      </div>

      <p className="mt-2 text-sm text-ink-600">
        60 tasks · 75 minutes · 3 subtests of {QUESTIONS_PER_SECTION} tasks
      </p>

      <div className="mt-4">
        <ProgressBar
          value={done / test.sections.length}
          label="Sections submitted"
          tone={complete ? 'success' : 'brand'}
        />
      </div>

      {score ? (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          Score {formatPoints(score.points)} / {score.maxPoints} ({formatPercent(score.percentage)})
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 pt-1">
        <LinkButton to={`/test/${test.id}`} variant="primary" size="sm">
          {complete
            ? 'View result'
            : running
              ? 'Resume section'
              : done > 0
                ? 'Continue test'
                : 'Test Mode'}
        </LinkButton>
        <LinkButton to={`/practice/${test.id}`} variant="outline" size="sm">
          Practice Mode
        </LinkButton>
      </div>
    </Card>
  );
}
