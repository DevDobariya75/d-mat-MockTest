import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { GENERAL_INSTRUCTIONS, QUESTIONS_PER_SECTION, SECTION_SPEC_BY_ID } from '@/data/examSpec';
import { useCamera } from '@/hooks/useCamera';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useTestSession } from '@/hooks/useTestSession';
import { formatDuration, formatPercent, formatPoints } from '@/lib/scoring';
import { isTestComplete, sectionAvailability } from '@/lib/sessionRules';
import { CameraPreview } from '@/components/CameraPreview';
import { FullscreenStatus } from '@/components/FullscreenGate';
import { Instructions, SectionInstructions } from '@/components/Instructions';
import { Badge, Button, Card, LinkButton, Modal, SectionHeading } from '@/components/ui';
import type { SectionId, TestSection } from '@/types';

/**
 * Test Mode landing screen.
 *
 * Shows the exam instructions, the optional camera check and one row per
 * subtest. A subtest can only be started from here, and only when the rules in
 * `sessionRules` allow it. Starting one navigates straight into the running
 * section, from where there is no way back until it is submitted.
 */

export function TestOverviewPage() {
  const params = useParams<{ testId: string }>();
  const testId = Number(params.testId);
  const navigate = useNavigate();
  const session = useTestSession(testId);
  const camera = useCamera();
  const fullscreen = useFullscreen();
  const [confirming, setConfirming] = useState<SectionId | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  if (!Number.isInteger(testId) || !session.test) {
    return <Navigate to="/" replace />;
  }

  const { test, attempt, score } = session;
  const complete = isTestComplete(attempt);

  // A section left running (for example after a refresh) is resumed directly.
  if (session.runningSection) {
    return <Navigate to={`/test/${testId}/section/${session.runningSection}`} replace />;
  }

  // Both conditions must be requested from the click itself: browsers only grant
  // camera access and fullscreen from inside a user gesture, never from an
  // effect afterwards. The camera goes first, so its permission prompt is not
  // buried under a freshly opened fullscreen window.
  const beginSection = async (sectionId: SectionId) => {
    setStartError(null);

    if (camera.supported && camera.status !== 'live') {
      const live = await camera.start();
      if (!live) {
        setStartError(
          'The subtest can only be started with the camera on. Allow camera access for this site and try again.',
        );
        return;
      }
    }

    if (fullscreen.supported && !fullscreen.isFullscreen) {
      const granted = await fullscreen.request();
      if (!granted) {
        setStartError(
          'The subtest can only be started in fullscreen. Allow fullscreen for this site and try again.',
        );
        return;
      }
    }

    if (session.startSection(sectionId)) {
      navigate(`/test/${testId}/section/${sectionId}`, { replace: true });
    }
    setConfirming(null);
  };

  /** What the start button has to obtain before the clock can run. */
  const conditions = [
    fullscreen.supported ? 'fullscreen' : null,
    camera.supported ? 'camera' : null,
  ].filter(Boolean) as string[];

  const confirmingSpec = confirming ? SECTION_SPEC_BY_ID[confirming] : null;
  const nextSpec = session.upcomingSection
    ? SECTION_SPEC_BY_ID[session.upcomingSection]
    : null;

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow={`Test Mode · ${test.title}`}
        title="Core Module"
        description="Three subtests, taken in order. 20 tasks and 25 minutes each — 60 tasks in 75 minutes."
        actions={
          <>
            <LinkButton to="/" variant="outline" size="sm">
              All mock tests
            </LinkButton>
            <LinkButton to={`/practice/${testId}`} variant="ghost" size="sm">
              Practice Mode
            </LinkButton>
          </>
        }
      />

      {complete && score ? (
        <Card className="flex flex-wrap items-center justify-between gap-4 border-emerald-300 bg-emerald-50 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Test completed
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-900">
              {formatPoints(score.points)} / {score.maxPoints} ({formatPercent(score.percentage)})
            </p>
            <p className="mt-0.5 text-sm text-emerald-800">
              Total time used {formatDuration(score.timeUsedMs)} of 75:00
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton to={`/test/${testId}/result`} variant="primary" size="md">
              Full result &amp; review
            </LinkButton>
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                if (
                  window.confirm(
                    'Clear this attempt and retake the whole test? Your current result will be deleted.',
                  )
                ) {
                  session.resetAttempt();
                }
              }}
            >
              Retake test
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Instructions
            title="Before you start"
            paragraphs={GENERAL_INSTRUCTIONS}
            footnote="Rules taken from the official dMAT preparatory materials for test takers (g.a.s.t. / TestDaF-Institut). See docs/DMAT_EXAM_SPEC.md."
          />

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-ink-900">Subtests</h2>
            {test.sections.map((section) => (
              <SectionRow
                key={section.id}
                testId={testId}
                section={section}
                availability={sectionAvailability(attempt, section.id)}
                attemptSummary={session.sectionOf(section.id)}
                onStart={() => setConfirming(section.id)}
              />
            ))}
          </div>

          {nextSpec ? <SectionInstructions spec={nextSpec} /> : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <FullscreenStatus fullscreen={fullscreen} required />
          <CameraPreview camera={camera} required />
          <Card className="p-4">
            <h3 className="text-sm font-bold text-ink-900">Marking</h3>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-ink-600">
              <li>· One point per task, 60 points in total.</li>
              <li>· No penalty for a wrong answer — always guess.</li>
              <li>
                · A figure series asks for two matrices, so each one is worth half a point.
              </li>
              <li>
                · Leaving fullscreen or losing the camera is recorded and shown in your result.
              </li>
            </ul>
          </Card>
        </aside>
      </div>

      <Modal
        open={confirming !== null}
        title={confirmingSpec ? `Start "${confirmingSpec.title}"?` : 'Start section?'}
        onClose={() => {
          setConfirming(null);
          setStartError(null);
        }}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setConfirming(null);
                setStartError(null);
              }}
            >
              Not yet
            </Button>
            <Button
              variant="primary"
              onClick={() => confirming && void beginSection(confirming)}
            >
              {conditions.length > 0
                ? `Enable ${conditions.join(' + ')} and start`
                : 'Start the 25-minute clock'}
            </Button>
          </>
        }
      >
        <p>
          The 25-minute countdown starts immediately. Once the section is running you cannot leave
          it, pause it or restart it — it ends when you submit or when the clock reaches zero.
        </p>
        <p className="mt-2">
          The subtest runs <strong>in fullscreen with your camera on</strong>. If you leave
          fullscreen or the camera stops, the questions are hidden until you restore it — and the
          clock keeps running. Nothing from the camera is recorded, stored or uploaded.
        </p>
        {conditions.length < 2 ? (
          <p className="mt-2 text-ink-500">
            {!fullscreen.supported && !camera.supported
              ? 'This browser offers neither fullscreen nor camera access, so neither can be enforced here.'
              : !fullscreen.supported
                ? 'This browser does not allow fullscreen, so the subtest runs in a normal window.'
                : 'This browser does not expose a camera, so the camera condition cannot be enforced here.'}
          </p>
        ) : null}
        <p className="mt-2">
          Your answers are saved continuously, so a refresh or a crash will not lose them. The clock
          keeps running in the background either way.
        </p>
        {startError ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
            {startError}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}

function SectionRow({
  testId,
  section,
  availability,
  attemptSummary,
  onStart,
}: {
  testId: number;
  section: TestSection;
  availability: ReturnType<typeof sectionAvailability>;
  attemptSummary: ReturnType<ReturnType<typeof useTestSession>['sectionOf']>;
  onStart: () => void;
}) {
  const spec = SECTION_SPEC_BY_ID[section.id];
  const answered = Object.keys(attemptSummary.answers).length;

  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-800 text-xs font-bold text-white">
            {section.order}
          </span>
          <h3 className="text-base font-bold text-ink-900">{spec.title}</h3>
          {availability.state === 'submitted' ? (
            <Badge tone="success">Submitted · locked</Badge>
          ) : availability.state === 'in-progress' ? (
            <Badge tone="danger">In progress</Badge>
          ) : availability.state === 'available' ? (
            <Badge tone="brand">Ready</Badge>
          ) : (
            <Badge tone="neutral">Locked</Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-600">
          {QUESTIONS_PER_SECTION} tasks · 25:00
          {availability.state === 'submitted'
            ? ` · ${answered} answered · time used ${formatDuration(attemptSummary.timeUsedMs)}${
                attemptSummary.autoSubmitted ? ' · auto-submitted' : ''
              }`
            : ''}
        </p>
        {availability.state === 'locked' ? (
          <p className="mt-1 text-xs text-ink-500">{availability.reason}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {availability.state === 'available' ? (
          <Button variant="primary" size="md" onClick={onStart}>
            Start section
          </Button>
        ) : availability.state === 'in-progress' ? (
          <LinkButton to={`/test/${testId}/section/${section.id}`} variant="danger" size="md">
            Resume
          </LinkButton>
        ) : availability.state === 'submitted' ? (
          <LinkButton
            to={`/test/${testId}/result?section=${section.id}`}
            variant="outline"
            size="md"
          >
            Review
          </LinkButton>
        ) : (
          <Button variant="outline" size="md" disabled>
            Locked
          </Button>
        )}
      </div>
    </Card>
  );
}
