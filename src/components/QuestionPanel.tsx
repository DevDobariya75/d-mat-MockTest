import { FigureSequenceView } from '@/components/questions/FigureSequenceView';
import { LatinSquaresView } from '@/components/questions/LatinSquaresView';
import { MathEquationsView } from '@/components/questions/MathEquationsView';
import { Badge } from '@/components/ui';
import type {
  Answer,
  Difficulty,
  FigureSequenceAnswer,
  LatinSquaresAnswer,
  MathEquationsAnswer,
  Question,
} from '@/types';

/**
 * Type-dispatching wrapper around the three question renderers, plus the shared
 * question header (number, difficulty, task-type reminder).
 */

const DIFFICULTY_TONE: Record<Difficulty, 'success' | 'warning' | 'danger'> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
};

export function QuestionBody({
  question,
  answer,
  onChange,
  disabled = false,
  reveal = false,
  allowScratch = false,
  onSubmitAnswer,
}: {
  question: Question;
  answer: Answer | undefined;
  onChange: (answer: Answer) => void;
  disabled?: boolean;
  reveal?: boolean;
  allowScratch?: boolean;
  /** Called when the test taker commits a typed answer (Enter). */
  onSubmitAnswer?: () => void;
}) {
  switch (question.type) {
    case 'figure-sequence':
      return (
        <FigureSequenceView
          question={question}
          answer={answer as FigureSequenceAnswer | undefined}
          onChange={(next) => onChange(next)}
          disabled={disabled}
          reveal={reveal}
        />
      );
    case 'math-equations':
      return (
        <MathEquationsView
          question={question}
          answer={answer as MathEquationsAnswer | undefined}
          onChange={(next) => onChange(next)}
          disabled={disabled}
          reveal={reveal}
          onSubmit={onSubmitAnswer}
        />
      );
    case 'latin-squares':
      return (
        <LatinSquaresView
          question={question}
          answer={answer as LatinSquaresAnswer | undefined}
          onChange={(next) => onChange(next)}
          disabled={disabled}
          reveal={reveal}
          allowScratch={allowScratch}
        />
      );
  }
}

export function QuestionPanel({
  question,
  index,
  total,
  answer,
  onChange,
  reminder,
  disabled = false,
  reveal = false,
  allowScratch = false,
  marked = false,
  actions,
  footer,
  onSubmitAnswer,
}: {
  question: Question;
  index: number;
  total: number;
  answer: Answer | undefined;
  onChange: (answer: Answer) => void;
  reminder?: string;
  disabled?: boolean;
  reveal?: boolean;
  allowScratch?: boolean;
  marked?: boolean;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  onSubmitAnswer?: () => void;
}) {
  return (
    <section
      className="rounded-xl border border-ink-200 bg-white shadow-card"
      aria-label={`Question ${index + 1} of ${total}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-bold text-ink-900">
            Question {index + 1}
            <span className="ml-1 font-medium text-ink-400">/ {total}</span>
          </h2>
          <Badge tone={DIFFICULTY_TONE[question.difficulty]}>{question.difficulty}</Badge>
          {marked ? <Badge tone="info">marked for review</Badge> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>

      {reminder ? (
        <p className="border-b border-ink-100 bg-ink-50/70 px-5 py-2 text-sm text-ink-600">
          {reminder}
        </p>
      ) : null}

      <div className="px-5 py-5">
        <QuestionBody
          question={question}
          answer={answer}
          onChange={onChange}
          disabled={disabled}
          reveal={reveal}
          allowScratch={allowScratch}
          onSubmitAnswer={onSubmitAnswer}
        />
      </div>

      {footer ? <div className="border-t border-ink-200 px-5 py-4">{footer}</div> : null}
    </section>
  );
}
