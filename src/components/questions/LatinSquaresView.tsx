import { useEffect, useState } from 'react';

import { LATIN_SIZE } from '@/data/examSpec';
import { COLUMN_NAMES, LETTERS } from '@/lib/latinSquare';
import { Button, cx } from '@/components/ui';
import type { LatinLetter, LatinSquaresAnswer, LatinSquaresQuestion } from '@/types';

/**
 * Renders one 5x5 Latin square with the question-mark field highlighted and the
 * response row of letters A-E beside it.
 *
 * `allowScratch` adds a pencil mode that lets the user pre-fill other fields.
 * It is only offered in Practice Mode, because the exam instructions state that
 * no notes and no helping tools are allowed.
 */

export function LatinSquaresView({
  question,
  answer,
  onChange,
  disabled = false,
  reveal = false,
  allowScratch = false,
}: {
  question: LatinSquaresQuestion;
  answer: LatinSquaresAnswer | undefined;
  onChange: (answer: LatinSquaresAnswer) => void;
  disabled?: boolean;
  reveal?: boolean;
  allowScratch?: boolean;
}) {
  const [scratchOn, setScratchOn] = useState(false);
  const [scratch, setScratch] = useState<Record<string, LatinLetter>>({});
  const [activeCell, setActiveCell] = useState<string | null>(null);

  // Never carry pencil marks from one question to the next.
  useEffect(() => {
    setScratch({});
    setActiveCell(null);
  }, [question.id]);

  const setScratchCell = (key: string, letter: LatinLetter | null) => {
    setScratch((current) => {
      const next = { ...current };
      if (letter === null) delete next[key];
      else next[key] = letter;
      return next;
    });
  };

  const gridToRender = reveal ? question.solution : question.grid;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-6">
        {/* The grid, with Greek column names and numbered rows as in the solution key. */}
        <div>
          <div className="inline-grid" style={{ gridTemplateColumns: `1.5rem repeat(${LATIN_SIZE}, auto)` }}>
            <div />
            {COLUMN_NAMES.map((name) => (
              <div
                key={name}
                className="pb-1 text-center text-sm font-bold text-ink-400"
                aria-hidden="true"
              >
                {name}
              </div>
            ))}
            {Array.from({ length: LATIN_SIZE }, (_, row) => (
              <FragmentRow
                key={row}
                row={row}
                question={question}
                gridToRender={gridToRender}
                answer={answer ?? null}
                reveal={reveal}
                scratch={scratch}
                scratchOn={scratchOn && allowScratch && !disabled}
                activeCell={activeCell}
                onActivate={setActiveCell}
              />
            ))}
          </div>
        </div>

        {/* Response row. */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
            Solution row
          </p>
          <div className="flex flex-col gap-1.5">
            {question.options.map((letter) => {
              const isChosen = answer === letter;
              const isCorrect = reveal && letter === question.answer;
              const isWrongChoice = reveal && isChosen && letter !== question.answer;
              return (
                <button
                  key={letter}
                  type="button"
                  disabled={disabled}
                  aria-pressed={isChosen}
                  // The tick/cross is decorative, so the name stays just the letter.
                  aria-label={letter}
                  onClick={() => {
                    if (disabled) return;
                    if (scratchOn && allowScratch && activeCell) {
                      setScratchCell(activeCell, letter);
                      return;
                    }
                    onChange(isChosen ? null : letter);
                  }}
                  className={cx(
                    'flex h-11 w-16 items-center justify-center rounded-md border-2 text-lg font-bold transition',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                    isCorrect
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : isWrongChoice
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : isChosen
                          ? 'border-brand-600 bg-brand-50 text-brand-700'
                          : 'border-ink-300 bg-white text-ink-800 hover:border-ink-400',
                    disabled && 'cursor-default',
                  )}
                >
                  {letter}
                  {isCorrect ? (
                    <span className="ml-1 text-sm" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                  {isWrongChoice ? (
                    <span className="ml-1 text-sm" aria-hidden="true">
                      ✗
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {allowScratch && !disabled ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-200 bg-ink-50/60 px-4 py-3">
          <Button
            variant={scratchOn ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => {
              setScratchOn((on) => !on);
              setActiveCell(null);
            }}
          >
            {scratchOn ? 'Pencil mode: on' : 'Pencil mode: off'}
          </Button>
          <p className="text-xs text-ink-600">
            Practice only — pick an empty field, then a letter to pre-fill it. The real exam allows
            no notes and no helping tools.
          </p>
          {Object.keys(scratch).length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setScratch({})}>
              Clear pencil marks
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FragmentRow({
  row,
  question,
  gridToRender,
  answer,
  reveal,
  scratch,
  scratchOn,
  activeCell,
  onActivate,
}: {
  row: number;
  question: LatinSquaresQuestion;
  gridToRender: (LatinLetter | null)[][];
  answer: LatinSquaresAnswer;
  reveal: boolean;
  scratch: Record<string, LatinLetter>;
  scratchOn: boolean;
  activeCell: string | null;
  onActivate: (key: string | null) => void;
}) {
  return (
    <>
      <div
        className="flex items-center justify-center pr-1 text-sm font-bold text-ink-400"
        aria-hidden="true"
      >
        {row + 1}
      </div>
      {Array.from({ length: LATIN_SIZE }, (_, col) => {
        const key = `${row},${col}`;
        const isTarget = question.target.row === row && question.target.col === col;
        const clue = question.grid[row]![col];
        const shown = isTarget
          ? reveal
            ? question.answer
            : (answer ?? null)
          : (clue ?? gridToRender[row]![col] ?? scratch[key] ?? null);
        const isScratch = !isTarget && !clue && scratch[key] !== undefined && !reveal;
        const isSolutionFill = !isTarget && !clue && reveal;
        const isActive = scratchOn && activeCell === key;

        const content = isTarget && shown === null ? '?' : (shown ?? '');

        const cellClasses = cx(
          'flex h-12 w-12 items-center justify-center border border-ink-400 text-lg font-bold',
          isTarget
            ? reveal
              ? 'border-2 border-emerald-500 bg-emerald-50 text-emerald-700'
              : 'border-2 border-red-500 bg-red-50/70 text-red-600'
            : isSolutionFill
              ? 'bg-ink-50 text-ink-400'
              : isScratch
                ? 'bg-sky-50 text-sky-700'
                : 'bg-white text-ink-900',
          isActive && 'ring-2 ring-inset ring-brand-500',
        );

        const clickable = scratchOn && !isTarget && !clue;

        return clickable ? (
          <button
            key={key}
            type="button"
            className={cx(cellClasses, 'transition hover:bg-sky-50')}
            onClick={() => onActivate(isActive ? null : key)}
            aria-label={`Pencil field ${COLUMN_NAMES[col]}${row + 1}`}
          >
            {content}
          </button>
        ) : (
          <div
            key={key}
            className={cellClasses}
            aria-label={
              isTarget
                ? `Question mark field ${COLUMN_NAMES[col]}${row + 1}`
                : `Field ${COLUMN_NAMES[col]}${row + 1}${shown ? `, letter ${shown}` : ', empty'}`
            }
          >
            {content}
          </div>
        );
      })}
    </>
  );
}

export const latinSquaresAnswerLabel = (answer: LatinSquaresAnswer | undefined): string =>
  answer ? `Letter ${answer}` : 'Not answered';

export const latinSquaresCorrectLabel = (question: LatinSquaresQuestion): string =>
  `Letter ${question.answer}`;

export const latinLetters = LETTERS;
