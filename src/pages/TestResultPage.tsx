import { useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';

import { SECTION_SPEC_BY_ID } from '@/data/examSpec';
import { useTestSession } from '@/hooks/useTestSession';
import { isTestComplete, submittedSectionCount } from '@/lib/sessionRules';
import { Result } from '@/components/Result';
import { ReviewList } from '@/components/ReviewList';
import { Badge, Button, Card, LinkButton, SectionHeading } from '@/components/ui';
import type { SectionId } from '@/types';

/**
 * Score report and question-by-question review.
 *
 * Reachable as soon as at least one section has been submitted; sections that
 * are still open are listed but cannot be reviewed yet.
 */

export function TestResultPage() {
  const params = useParams<{ testId: string }>();
  const testId = Number(params.testId);
  const [searchParams, setSearchParams] = useSearchParams();
  const session = useTestSession(testId);
  const [showAllQuestions, setShowAllQuestions] = useState(false);

  if (!Number.isInteger(testId) || !session.test || !session.score) {
    return <Navigate to="/" replace />;
  }

  const { test, attempt, score } = session;

  if (submittedSectionCount(attempt) === 0) {
    return <Navigate to={`/test/${testId}`} replace />;
  }

  const requested = searchParams.get('section') as SectionId | null;
  const submittedSections = test.sections.filter(
    (section) => attempt.sections[section.id]?.status === 'submitted',
  );
  const activeSectionId: SectionId =
    requested && submittedSections.some((section) => section.id === requested)
      ? requested
      : (submittedSections[0]?.id ?? test.sections[0]!.id);

  const activeSection = test.sections.find((section) => section.id === activeSectionId)!;
  const activeScore = score.sections.find((item) => item.sectionId === activeSectionId)!;
  const activeAttempt = attempt.sections[activeSectionId];
  const complete = isTestComplete(attempt);

  const shownQuestions = showAllQuestions
    ? activeSection.questions
    : activeSection.questions.slice(0, 10);

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow={`Result · ${test.title}`}
        title="Core Module score report"
        description={
          complete
            ? 'All three subtests are submitted. Below is the full score report and a task-by-task review.'
            : 'Partial result — the subtests you have submitted so far.'
        }
        actions={
          <>
            <LinkButton to={`/test/${testId}`} variant="outline" size="sm">
              Test overview
            </LinkButton>
            <LinkButton to={`/practice/${testId}`} variant="ghost" size="sm">
              Practice these tasks
            </LinkButton>
          </>
        }
      />

      {!complete ? (
        <Card className="border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong className="font-semibold">
            {submittedSectionCount(attempt)} of {test.sections.length} subtests submitted.
          </strong>{' '}
          The totals below only count the sections you have finished. Go back to the overview to
          start the next one.
        </Card>
      ) : null}

      <Result score={score} />

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink-900">Question-by-question review</h2>
          <div className="flex flex-wrap gap-2">
            {test.sections.map((section) => {
              const submitted = attempt.sections[section.id]?.status === 'submitted';
              return (
                <Button
                  key={section.id}
                  size="sm"
                  variant={section.id === activeSectionId ? 'secondary' : 'outline'}
                  disabled={!submitted}
                  onClick={() => {
                    setShowAllQuestions(false);
                    setSearchParams({ section: section.id });
                  }}
                >
                  {SECTION_SPEC_BY_ID[section.id].title}
                  {!submitted ? ' (open)' : ''}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-600">
          <Badge tone="brand">{activeScore.title}</Badge>
          <span className="tabular-nums">
            {activeScore.correct} correct · {activeScore.partial} partial ·{' '}
            {activeScore.incorrect} incorrect · {activeScore.unanswered} unanswered
          </span>
        </div>

        <div className="mt-4">
          <ReviewList
            questions={shownQuestions}
            answers={activeAttempt?.answers ?? {}}
            scores={activeScore.questions.filter((item) =>
              shownQuestions.some((question) => question.id === item.questionId),
            )}
          />
        </div>

        {!showAllQuestions && activeSection.questions.length > shownQuestions.length ? (
          <div className="mt-4 text-center">
            <Button variant="outline" onClick={() => setShowAllQuestions(true)}>
              Show all {activeSection.questions.length} tasks
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
