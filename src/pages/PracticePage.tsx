import { useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { SECTION_SPEC_BY_ID } from '@/data/examSpec';
import { usePracticeSession } from '@/hooks/usePracticeSession';
import { useFullscreen } from '@/hooks/useFullscreen';
import { buildPalette, nextIndex, previousIndex } from '@/lib/navigation';
import { isBlank, isComplete, questionAutoReveals, scoreQuestion } from '@/lib/scoring';
import { Explanation } from '@/components/Explanation';
import { QuestionPalette } from '@/components/QuestionPalette';
import { QuestionPanel } from '@/components/QuestionPanel';
import { FullscreenStatus } from '@/components/FullscreenGate';
import { SectionInstructions } from '@/components/Instructions';
import { correctAnswerLabel } from '@/components/ReviewList';
import { Badge, Button, Card, LinkButton, ProgressBar, SectionHeading, cx } from '@/components/ui';
import type { Answer, SectionId } from '@/types';

/**
 * Practice Mode.
 *
 * No clock and no section order. Answering a task immediately reveals whether
 * it was right, together with the correct answer and the solution path, and any
 * task can be retried or revisited freely.
 */

export function PracticePage() {
  const params = useParams<{ testId: string }>();
  const testId = Number(params.testId);
  const session = usePracticeSession(testId);
  // Optional here: practice is not a proctored exam, so it is the user's choice.
  const fullscreen = useFullscreen();

  const {
    test,
    sectionId,
    setSectionId,
    questions,
    cursor,
    goTo,
    answers,
    submitAnswer,
    revealAnswer,
    isRevealed,
    retry,
    reset,
    progress,
  } = session;

  const palette = useMemo(() => {
    // Only finished tasks show as answered, so a half-filled figure series does
    // not look done. Anything touched counts as visited.
    const completed: Record<string, Answer> = {};
    for (const item of questions) {
      const value = answers[item.id];
      if (isComplete(item, value)) completed[item.id] = value as Answer;
    }
    return buildPalette(questions, completed, [], Object.keys(answers));
  }, [questions, answers]);

  if (!Number.isInteger(testId) || !test) {
    return <Navigate to="/" replace />;
  }

  const spec = SECTION_SPEC_BY_ID[sectionId];
  const question = questions[cursor];
  const answer = question ? answers[question.id] : undefined;
  // The hook only marks a task revealed once it is finished (or the test taker
  // asked to see the answer), so this is the single source of truth.
  const revealed = question ? isRevealed(question.id) : false;
  const result = question && revealed ? scoreQuestion(question, answer) : null;
  const started = question ? !isBlank(answer) : false;
  const finished = question ? isComplete(question, answer) : false;
  // Typed tasks are committed by hand, so they need a Check answer action.
  const needsCheck = question ? !questionAutoReveals(question) : false;

  const handleAnswer = (next: Answer) => {
    if (!question) return;
    submitAnswer(question.id, next);
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow={`Practice Mode · ${test.title}`}
        title="Practice by task type"
        description="No timer, no restrictions. Answer a task to see instantly whether it was right, with the correct answer and the solution path."
        actions={
          <>
            {fullscreen.supported ? (
              <Button
                variant={fullscreen.isFullscreen ? 'secondary' : 'outline'}
                size="sm"
                onClick={() =>
                  void (fullscreen.isFullscreen ? fullscreen.exit() : fullscreen.request())
                }
                aria-pressed={fullscreen.isFullscreen}
              >
                {fullscreen.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              </Button>
            ) : null}
            <LinkButton to={`/test/${testId}`} variant="outline" size="sm">
              Test Mode
            </LinkButton>
            <LinkButton to="/" variant="ghost" size="sm">
              All mock tests
            </LinkButton>
          </>
        }
      />

      {/* Section switcher: every section is always reachable. */}
      <div className="flex flex-wrap gap-2">
        {test.sections.map((section) => (
          <Button
            key={section.id}
            size="sm"
            variant={section.id === sectionId ? 'secondary' : 'outline'}
            onClick={() => setSectionId(section.id as SectionId)}
          >
            {SECTION_SPEC_BY_ID[section.id].title}
          </Button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-4">
          {question ? (
            <>
              <QuestionPanel
                question={question}
                index={cursor}
                total={questions.length}
                answer={answer}
                onChange={handleAnswer}
                reminder={spec.reminder}
                disabled={revealed}
                reveal={revealed}
                allowScratch={!revealed}
                onSubmitAnswer={
                  needsCheck && finished && !revealed
                    ? () => revealAnswer(question.id)
                    : undefined
                }
                actions={
                  result ? (
                    <Badge
                      tone={
                        result.outcome === 'correct'
                          ? 'success'
                          : result.outcome === 'partial'
                            ? 'warning'
                            : result.outcome === 'unanswered'
                              ? 'neutral'
                              : 'danger'
                      }
                    >
                      {result.outcome === 'correct'
                        ? 'Correct'
                        : result.outcome === 'partial'
                          ? 'Partially correct'
                          : result.outcome === 'unanswered'
                            ? 'Revealed'
                            : 'Incorrect'}
                    </Badge>
                  ) : started ? (
                    <Badge tone="info">In progress</Badge>
                  ) : (
                    <Badge tone="neutral">Not answered yet</Badge>
                  )
                }
                footer={
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="md"
                      disabled={cursor === 0}
                      onClick={() => goTo(previousIndex(cursor, questions.length))}
                    >
                      ← Previous
                    </Button>
                    {!revealed && started && !finished ? (
                      <span className="text-xs text-ink-500">
                        {needsCheck
                          ? 'Fill in every unknown, then check your answer.'
                          : 'Complete every part of the task to see the result.'}
                      </span>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {revealed ? (
                        <Button variant="ghost" size="md" onClick={() => retry(question.id)}>
                          Try again
                        </Button>
                      ) : (
                        <>
                          {needsCheck ? (
                            <Button
                              variant="secondary"
                              size="md"
                              disabled={!finished}
                              onClick={() => revealAnswer(question.id)}
                            >
                              Check answer
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="md"
                            onClick={() => revealAnswer(question.id)}
                          >
                            {started ? 'Give up and show answer' : 'Show answer'}
                          </Button>
                        </>
                      )}
                      <Button
                        variant="primary"
                        size="md"
                        disabled={cursor === questions.length - 1}
                        onClick={() => goTo(nextIndex(cursor, questions.length))}
                      >
                        Next →
                      </Button>
                    </div>
                  </div>
                }
              />

              {revealed && result ? (
                <Card
                  className={cx(
                    'p-5',
                    result.outcome === 'correct'
                      ? 'border-emerald-300 bg-emerald-50/70'
                      : result.outcome === 'partial'
                        ? 'border-amber-300 bg-amber-50/70'
                        : result.outcome === 'unanswered'
                          ? 'border-ink-300 bg-ink-50'
                          : 'border-red-300 bg-red-50/70',
                  )}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <h3
                      className={cx(
                        'text-base font-bold',
                        result.outcome === 'correct'
                          ? 'text-emerald-800'
                          : result.outcome === 'partial'
                            ? 'text-amber-800'
                            : result.outcome === 'unanswered'
                              ? 'text-ink-800'
                              : 'text-red-800',
                      )}
                    >
                      {result.outcome === 'correct'
                        ? 'Correct!'
                        : result.outcome === 'partial'
                          ? 'Partially correct'
                          : result.outcome === 'unanswered'
                            ? 'Answer revealed'
                            : 'Not correct'}
                    </h3>
                    <span className="text-sm font-medium text-ink-700">
                      Correct answer: <strong>{correctAnswerLabel(question)}</strong>
                    </span>
                  </div>
                  <div className="mt-3">
                    <Explanation lines={question.explanation} />
                  </div>
                </Card>
              ) : null}
            </>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="p-4">
            <h3 className="text-sm font-bold text-ink-900">Progress in this section</h3>
            <p className="mt-1 text-2xl font-bold tabular-nums text-ink-900">
              {progress.correct}
              <span className="text-base font-semibold text-ink-400">
                {' '}
                / {progress.answered} correct
              </span>
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              {progress.answered} of {progress.total} tasks attempted
            </p>
            <div className="mt-3">
              <ProgressBar
                value={progress.total === 0 ? 0 : progress.answered / progress.total}
                label="Attempted"
              />
            </div>
            <Button variant="ghost" size="sm" className="mt-3" onClick={reset}>
              Reset practice progress
            </Button>
          </Card>

          <QuestionPalette
            entries={palette}
            current={cursor}
            onJump={goTo}
            title={`${spec.title} · ${questions.length} tasks`}
          />

          <FullscreenStatus fullscreen={fullscreen} required={false} />
        </aside>
      </div>

      <SectionInstructions spec={spec} />
    </div>
  );
}
