import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useBlocker, useNavigate, useParams } from 'react-router-dom';

import { SECTION_DURATION_MS, SECTION_SPEC_BY_ID } from '@/data/examSpec';
import { useCamera } from '@/hooks/useCamera';
import { useCountdown } from '@/hooks/useCountdown';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useTestSession } from '@/hooks/useTestSession';
import { buildPalette, clampIndex, nextIndex, previousIndex } from '@/lib/navigation';
import { isBlank } from '@/lib/scoring';
import { CameraPreview } from '@/components/CameraPreview';
import { ExamGate, type GateRequirement } from '@/components/ExamGate';
import { QuestionPalette } from '@/components/QuestionPalette';
import { QuestionPanel } from '@/components/QuestionPanel';
import { Timer } from '@/components/Timer';
import { Badge, Button, Modal } from '@/components/ui';
import type { Answer, SectionId } from '@/types';

/**
 * A running subtest.
 *
 * This screen is deliberately a dead end: there is no navigation out of it, the
 * router is blocked, and the browser is asked to confirm a reload. The only
 * ways out are submitting or letting the clock run out, which auto-submits.
 */

export function TestSectionPage() {
  const params = useParams<{ testId: string; sectionId: string }>();
  const testId = Number(params.testId);
  const sectionId = params.sectionId as SectionId;
  const navigate = useNavigate();
  const session = useTestSession(testId);

  // Every broken exam condition during a running section is recorded on the
  // attempt, so it survives a refresh and shows up in the result.
  const runningRef = useRef(false);
  const fullscreen = useFullscreen({
    onExit: () => {
      if (runningRef.current) session.recordFullscreenExit(sectionId);
    },
  });
  const camera = useCamera({
    onInterrupt: () => {
      if (runningRef.current) session.recordCameraInterruption(sectionId);
    },
  });
  /** Set once this screen has asked for the camera, so 'idle' is not mistaken for a refusal. */
  const cameraRequested = useRef(false);

  const [confirmSubmit, setConfirmSubmit] = useState(false);
  /** Set once this screen submits the section, so it can confirm before leaving. */
  const [submittedHere, setSubmittedHere] = useState<'manual' | 'auto' | null>(null);
  const [cursor, setCursor] = useState(0);
  const [cursorReady, setCursorReady] = useState(false);
  /** Flipped just before the one navigation this screen is allowed to make. */
  const allowLeave = useRef(false);

  const section = session.test?.sections.find((candidate) => candidate.id === sectionId);
  const sectionAttempt = session.sectionOf(sectionId);
  const running = sectionAttempt.status === 'in-progress';
  runningRef.current = running;
  const questions = section?.questions ?? [];

  // Fullscreen and the camera are conditions for taking the test, but neither
  // can be enforced on a browser that does not offer it at all.
  const blockedByFullscreen = running && fullscreen.supported && !fullscreen.isFullscreen;
  const cameraSettled =
    camera.status !== 'requesting' && (cameraRequested.current || camera.status !== 'idle');
  const blockedByCamera =
    running && camera.supported && cameraSettled && camera.status !== 'live';
  const blocked = blockedByFullscreen || blockedByCamera;

  // Restore the question the test taker was last on after a refresh.
  useEffect(() => {
    if (cursorReady || questions.length === 0) return;
    setCursor(clampIndex(sectionAttempt.cursor, questions.length));
    setCursorReady(true);
  }, [cursorReady, questions.length, sectionAttempt.cursor]);

  const submit = useCallback(
    (auto: boolean) => {
      session.submitSection(sectionId, { auto });
      setSubmittedHere(auto ? 'auto' : 'manual');
    },
    [session, sectionId],
  );

  /** The single sanctioned way out of this screen. */
  const leave = useCallback(() => {
    allowLeave.current = true;
    void fullscreen.exit();
    camera.stop();
    navigate(`/test/${testId}`, { replace: true });
  }, [camera, fullscreen, navigate, testId]);

  const { remainingMs } = useCountdown(sectionAttempt.endsAt, {
    active: running,
    onExpire: () => submit(true),
  });

  useEffect(() => {
    if (!running || !camera.supported) return;
    if (camera.status !== 'idle') return;
    cameraRequested.current = true;
    void camera.start();
  }, [camera, running]);

  // Warn before a reload so an accidental refresh is not mistaken for an exit.
  useEffect(() => {
    if (!running) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [running]);

  // Block in-app navigation (including the browser back button) while running.
  // `leave()` is the one exception, and it announces itself through the ref.
  const blocker = useBlocker(
    useCallback(() => running && !allowLeave.current, [running]),
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (allowLeave.current) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  const currentQuestion = questions[cursor];
  const answer = currentQuestion ? sectionAttempt.answers[currentQuestion.id] : undefined;

  const palette = useMemo(
    () =>
      buildPalette(
        questions,
        sectionAttempt.answers,
        sectionAttempt.marked,
        sectionAttempt.visited,
      ),
    [questions, sectionAttempt.answers, sectionAttempt.marked, sectionAttempt.visited],
  );

  const goTo = useCallback(
    (index: number) => {
      const next = clampIndex(index, questions.length);
      setCursor(next);
      const question = questions[next];
      if (question) session.visit(sectionId, question.id, next);
    },
    [questions, session, sectionId],
  );

  // Record the first question as visited once the section is live.
  useEffect(() => {
    if (!running || !currentQuestion) return;
    if (!sectionAttempt.visited.includes(currentQuestion.id)) {
      session.visit(sectionId, currentQuestion.id, cursor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, currentQuestion?.id]);

  // Keyboard navigation, as in the real digital test.
  useEffect(() => {
    if (!running || blocked) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (event.key === 'ArrowRight') goTo(nextIndex(cursor, questions.length));
      if (event.key === 'ArrowLeft') goTo(previousIndex(cursor, questions.length));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [blocked, cursor, goTo, questions.length, running]);

  if (!Number.isInteger(testId) || !session.test || !section) {
    return <Navigate to="/" replace />;
  }

  // Not started yet: the clock may only be started from the overview screen.
  if (sectionAttempt.status === 'not-started') {
    return <Navigate to={`/test/${testId}`} replace />;
  }

  // Arriving at a section that was already submitted in an earlier visit.
  if (sectionAttempt.status === 'submitted' && submittedHere === null) {
    return <Navigate to={`/test/${testId}`} replace />;
  }

  const spec = SECTION_SPEC_BY_ID[sectionId];
  const answeredCount = questions.filter((question) => !isBlank(sectionAttempt.answers[question.id]))
    .length;
  const markedCount = sectionAttempt.marked.length;
  const isMarked = currentQuestion
    ? sectionAttempt.marked.includes(currentQuestion.id)
    : false;

  const handleAnswer = (next: Answer) => {
    if (!currentQuestion) return;
    session.setAnswer(sectionId, currentQuestion.id, next);
  };

  const gateRequirements: GateRequirement[] = [];
  if (blockedByFullscreen) {
    gateRequirements.push({
      key: 'fullscreen',
      title: 'Return to fullscreen',
      description: 'This subtest must be taken in fullscreen.',
      actionLabel: 'Return to fullscreen',
      onAction: () => void fullscreen.request(),
      error: fullscreen.error,
      note:
        sectionAttempt.fullscreenExits > 1
          ? `You have left fullscreen ${sectionAttempt.fullscreenExits} times. This is recorded in your result.`
          : null,
    });
  }
  if (blockedByCamera) {
    gateRequirements.push({
      key: 'camera',
      title: 'Switch the camera back on',
      description:
        'This subtest must be taken with the camera on. Nothing is recorded, stored or uploaded.',
      actionLabel: camera.status === 'denied' ? 'Allow the camera' : 'Turn the camera on',
      onAction: () => void camera.start(),
      error: camera.error,
      note:
        sectionAttempt.cameraInterruptions > 1
          ? `The camera has stopped ${sectionAttempt.cameraInterruptions} times. This is recorded in your result.`
          : null,
    });
  }

  return (
    <div className="space-y-5">
      {/* Exam chrome: no links out of here. */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-ink-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-600">
              {session.test.title} · Section {section.order} of {session.test.sections.length}
            </p>
            <h1 className="truncate text-xl font-bold text-ink-900">{spec.title}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden text-right text-xs text-ink-500 sm:block">
              <p>
                <strong className="font-semibold text-ink-900 tabular-nums">
                  {answeredCount}
                </strong>{' '}
                of {questions.length} answered
              </p>
              <p>
                <strong className="font-semibold text-ink-900 tabular-nums">{markedCount}</strong>{' '}
                marked for review
              </p>
            </div>
            <Timer remainingMs={remainingMs} durationMs={SECTION_DURATION_MS} />
            <Button variant="danger" size="md" onClick={() => setConfirmSubmit(true)}>
              Submit section
            </Button>
          </div>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <Badge tone="danger">Section locked</Badge>
          {fullscreen.supported ? (
            <Badge tone={fullscreen.isFullscreen ? 'success' : 'warning'}>
              {fullscreen.isFullscreen ? 'Fullscreen' : 'Fullscreen required'}
            </Badge>
          ) : null}
          {camera.supported ? (
            <Badge tone={camera.status === 'live' ? 'success' : 'warning'}>
              {camera.status === 'live' ? 'Camera on' : 'Camera required'}
            </Badge>
          ) : null}
          You cannot leave, pause or restart this section. It is submitted automatically when the
          clock reaches zero.
        </p>
      </div>

      <div
        className="grid gap-5 lg:grid-cols-[1fr_18rem]"
        // The questions must not be readable while outside fullscreen.
        aria-hidden={blocked}
        inert={blocked}
        style={blocked ? { filter: 'blur(14px)', pointerEvents: 'none' } : undefined}
      >
        <div className="space-y-4">
          {currentQuestion ? (
            <QuestionPanel
              question={currentQuestion}
              index={cursor}
              total={questions.length}
              answer={answer}
              onChange={handleAnswer}
              reminder={spec.reminder}
              marked={isMarked}
              actions={
                <>
                  <Button
                    variant={isMarked ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => session.toggleMark(sectionId, currentQuestion.id)}
                  >
                    {isMarked ? 'Unmark' : 'Mark for review'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isBlank(answer)}
                    onClick={() => session.clearAnswer(sectionId, currentQuestion.id)}
                  >
                    Clear response
                  </Button>
                </>
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
                  <span className="text-xs text-ink-500">
                    Use the palette or the arrow keys to jump between tasks.
                  </span>
                  {cursor === questions.length - 1 ? (
                    <Button variant="danger" size="md" onClick={() => setConfirmSubmit(true)}>
                      Submit section
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => goTo(nextIndex(cursor, questions.length))}
                    >
                      Next →
                    </Button>
                  )}
                </div>
              }
            />
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <QuestionPalette
            entries={palette}
            current={cursor}
            onJump={goTo}
            title={`${spec.title} · ${questions.length} tasks`}
          />
          <CameraPreview camera={camera} size="sm" required />
        </aside>
      </div>

      {blocked ? (
        <ExamGate
          requirements={gateRequirements}
          remainingMs={remainingMs}
          onSubmit={() => submit(false)}
        />
      ) : null}

      <Modal
        open={confirmSubmit && running && !blocked}
        title="Submit this section?"
        onClose={() => setConfirmSubmit(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmSubmit(false)}>
              Keep working
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmSubmit(false);
                submit(false);
              }}
            >
              Submit and lock
            </Button>
          </>
        }
      >
        <p>
          You have answered{' '}
          <strong>
            {answeredCount} of {questions.length}
          </strong>{' '}
          tasks
          {markedCount > 0 ? (
            <>
              , with <strong>{markedCount}</strong> still marked for review
            </>
          ) : null}
          .
        </p>
        <p className="mt-2">
          Submitting locks this section for good — you cannot come back to it. There is no penalty
          for a wrong answer, so it is worth guessing on anything you left open.
        </p>
      </Modal>

      <Modal
        open={submittedHere !== null}
        title={submittedHere === 'auto' ? 'Time is up' : 'Section submitted'}
        footer={
          <Button variant="primary" onClick={leave}>
            Continue
          </Button>
        }
      >
        {submittedHere === 'auto' ? (
          <p>
            The 25 minutes for <strong>{spec.title}</strong> have elapsed, so the section was
            submitted automatically with the answers you had given.
          </p>
        ) : (
          <p>
            <strong>{spec.title}</strong> has been submitted and is now locked. You answered{' '}
            {answeredCount} of {questions.length} tasks.
          </p>
        )}
        <p className="mt-2">
          {session.upcomingSection
            ? 'You may take as much time as you like before starting the next section.'
            : 'That was the last section — your full score report is ready.'}
        </p>
      </Modal>

      <p className="rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-xs text-ink-500">
        Answers are saved as you go. The countdown is based on a fixed end time, so reloading the
        page does not give you extra time.
      </p>
    </div>
  );
}
