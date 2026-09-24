import { FigureMatrixView, UnknownMatrixView } from '@/components/FigureMatrixView';
import { cx } from '@/components/ui';
import type { FigureSequenceAnswer, FigureSequenceQuestion } from '@/types';

/**
 * Renders one figure series: matrices 1-4, the two blanks, and the three
 * response matrices offered for each blank — the layout of the official
 * preparatory materials, where the options are labelled "Matrix 1/2/3".
 */

const BLANK_LABELS = ['Image 1', 'Image 2'];

export function FigureSequenceView({
  question,
  answer,
  onChange,
  disabled = false,
  reveal = false,
}: {
  question: FigureSequenceQuestion;
  answer: FigureSequenceAnswer | undefined;
  onChange: (answer: FigureSequenceAnswer) => void;
  disabled?: boolean;
  reveal?: boolean;
}) {
  const current: FigureSequenceAnswer = answer ?? [null, null];

  const select = (blank: number, option: number) => {
    if (disabled) return;
    const next: FigureSequenceAnswer = [current[0] ?? null, current[1] ?? null];
    next[blank] = next[blank] === option ? null : option;
    onChange(next);
  };

  return (
    <div className="space-y-6">
      {/* The series itself. */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
          The series
        </p>
        <div className="flex flex-wrap items-start gap-3 overflow-x-auto pb-1">
          {question.given.map((matrix, index) => (
            <div key={index} className="flex flex-col items-center gap-1">
              <FigureMatrixView matrix={matrix} scale="lg" label={`Matrix ${index + 1}`} />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                Matrix {index + 1}
              </span>
            </div>
          ))}
          {BLANK_LABELS.map((label) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <UnknownMatrixView scale="lg" label={label} />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-500">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Response options, one column per blank. */}
      <div className="grid gap-5 sm:grid-cols-2">
        {question.options.map((optionSet, blank) => {
          const chosen = current[blank] ?? null;
          const correct = question.answer[blank];
          return (
            <fieldset
              key={blank}
              className="rounded-lg border border-ink-200 bg-ink-50/60 p-4"
              aria-label={`Response options for ${BLANK_LABELS[blank]}`}
            >
              <legend className="px-1 text-sm font-bold text-ink-800">
                {BLANK_LABELS[blank]}
                {chosen === null ? (
                  <span className="ml-2 text-xs font-medium text-ink-500">not answered</span>
                ) : null}
              </legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {optionSet.map((matrix, option) => {
                  const isChosen = chosen === option;
                  const isCorrect = reveal && option === correct;
                  const isWrongChoice = reveal && isChosen && option !== correct;
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={disabled}
                      aria-pressed={isChosen}
                      onClick={() => select(blank, option)}
                      className={cx(
                        'flex flex-col items-center gap-1 rounded-lg border-2 bg-white p-2 transition',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                        isCorrect
                          ? 'border-emerald-500 ring-2 ring-emerald-200'
                          : isWrongChoice
                            ? 'border-red-500 ring-2 ring-red-200'
                            : isChosen
                              ? 'border-brand-600 ring-2 ring-brand-200'
                              : 'border-ink-200 hover:border-ink-400',
                        disabled && 'cursor-default',
                      )}
                    >
                      <FigureMatrixView
                        matrix={matrix}
                        scale="sm"
                        label={`${BLANK_LABELS[blank]} option ${option + 1}`}
                      />
                      <span
                        className={cx(
                          'text-[10px] font-bold uppercase tracking-wide',
                          isCorrect
                            ? 'text-emerald-700'
                            : isWrongChoice
                              ? 'text-red-700'
                              : isChosen
                                ? 'text-brand-700'
                                : 'text-ink-500',
                        )}
                      >
                        Matrix {option + 1}
                        {isCorrect ? ' ✓' : isWrongChoice ? ' ✗' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

/** Compact summary of a submitted answer, used in the results review. */
export function figureSequenceAnswerLabel(answer: FigureSequenceAnswer | undefined): string {
  if (!answer) return 'Not answered';
  return BLANK_LABELS.map(
    (label, blank) =>
      `${label}: ${answer[blank] === null || answer[blank] === undefined ? '—' : `Matrix ${answer[blank]! + 1}`}`,
  ).join(' · ');
}

export function figureSequenceCorrectLabel(question: FigureSequenceQuestion): string {
  return BLANK_LABELS.map(
    (label, blank) => `${label}: Matrix ${question.answer[blank]! + 1}`,
  ).join(' · ');
}
