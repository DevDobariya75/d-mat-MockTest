import { MAX_VARIABLE_VALUE, MIN_VARIABLE_VALUE } from '@/data/examSpec';
import { cx } from '@/components/ui';
import type { MathEquationsAnswer, MathEquationsQuestion } from '@/types';

/**
 * Renders one system of equations plus one numeric field per unknown.
 *
 * Values are restricted to whole numbers in 1..20, the range the official
 * instructions give, and the field rejects anything else as you type.
 */

export function MathEquationsView({
  question,
  answer,
  onChange,
  disabled = false,
  reveal = false,
  onSubmit,
}: {
  question: MathEquationsQuestion;
  answer: MathEquationsAnswer | undefined;
  onChange: (answer: MathEquationsAnswer) => void;
  disabled?: boolean;
  reveal?: boolean;
  /** Called on Enter, so a typed solution can be committed from the keyboard. */
  onSubmit?: () => void;
}) {
  const current: MathEquationsAnswer = answer ?? {};

  const setValue = (name: string, raw: string) => {
    if (disabled) return;
    const next: MathEquationsAnswer = {};
    for (const variable of question.variables) next[variable] = current[variable] ?? null;

    if (raw.trim() === '') {
      next[name] = null;
    } else {
      if (!/^\d{1,2}$/.test(raw)) return;
      const value = Number(raw);
      if (value < MIN_VARIABLE_VALUE || value > MAX_VARIABLE_VALUE) return;
      next[name] = value;
    }
    onChange(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
          System of equations
        </p>
        <ul className="inline-flex flex-col gap-2 rounded-lg border border-ink-200 bg-ink-50/60 px-6 py-4">
          {question.equations.map((equation, index) => (
            <li
              key={index}
              className="font-mono text-xl font-semibold tracking-wide text-ink-900 sm:text-2xl"
            >
              {equation}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
          Your solution
        </p>
        <div className="flex flex-wrap gap-4">
          {question.variables.map((name) => {
            const value = current[name];
            const expected = question.answer[name];
            const isCorrect = reveal && value !== null && value !== undefined && value === expected;
            const isWrong = reveal && value !== null && value !== undefined && value !== expected;
            const inputId = `${question.id}-${name}`;
            return (
              <div key={name} className="flex items-center gap-2">
                <label
                  htmlFor={inputId}
                  className="font-mono text-xl font-bold text-ink-900"
                >
                  {name} =
                </label>
                <input
                  id={inputId}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  disabled={disabled}
                  value={value === null || value === undefined ? '' : String(value)}
                  onChange={(event) => setValue(name, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && onSubmit) {
                      event.preventDefault();
                      onSubmit();
                    }
                  }}
                  aria-label={`Value for ${name}, a whole number from ${MIN_VARIABLE_VALUE} to ${MAX_VARIABLE_VALUE}`}
                  className={cx(
                    'w-20 rounded-lg border-2 px-3 py-2 text-center font-mono text-xl font-semibold tabular-nums',
                    'focus:outline-none focus:ring-2',
                    isCorrect
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 focus:ring-emerald-200'
                      : isWrong
                        ? 'border-red-500 bg-red-50 text-red-800 focus:ring-red-200'
                        : 'border-ink-300 bg-white text-ink-900 focus:border-brand-500 focus:ring-brand-200',
                    disabled && 'cursor-default opacity-90',
                  )}
                />
                {reveal && isWrong ? (
                  <span className="font-mono text-sm font-semibold text-emerald-700">
                    → {expected}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-500">
          Each letter is a whole number between {MIN_VARIABLE_VALUE} and {MAX_VARIABLE_VALUE}. A
          system counts as solved only when every letter is correct.
        </p>
      </div>
    </div>
  );
}

export function mathEquationsAnswerLabel(
  question: MathEquationsQuestion,
  answer: MathEquationsAnswer | undefined,
): string {
  if (!answer) return 'Not answered';
  const parts = question.variables.map((name) => {
    const value = answer[name];
    return `${name} = ${value === null || value === undefined ? '—' : value}`;
  });
  return parts.join(', ');
}

export function mathEquationsCorrectLabel(question: MathEquationsQuestion): string {
  return question.variables.map((name) => `${name} = ${question.answer[name]}`).join(', ');
}
