import type { Question } from '@/types';

/**
 * Canonical identity of a question, used to keep all 600 tasks distinct.
 *
 * Two questions are "the same task" when a test taker would recognise them as
 * such, which is weaker than being byte-identical:
 *
 *  - an equation system is unchanged by the order its equations are printed in,
 *    and by which letters the unknowns happen to be called;
 *  - a Latin square is unchanged by which letters fill the grid;
 *  - a figure series is defined by how the figures *move*, not by which shapes
 *    and colours happen to be drawn — the same path with a different glyph reads
 *    as a repeat of the same puzzle.
 *
 * The generator therefore de-duplicates on these signatures rather than on the
 * raw question data. `signaturesOf` returns every notion, strictest first, so
 * the audit can report them separately.
 */

/** Renames tokens to `v0`, `v1`, ... in order of first appearance. */
function relabel(text: string, pattern: RegExp): string {
  const mapping = new Map<string, string>();
  return text.replace(pattern, (token) => {
    if (!mapping.has(token)) mapping.set(token, `v${mapping.size}`);
    return mapping.get(token)!;
  });
}

/** The movement path of every figure, independent of shape and colour. */
export function figureMovementSignature(question: Question): string {
  if (question.type !== 'figure-sequence') return '';
  const shapes = [
    ...new Set(question.given.flatMap((matrix) => matrix.figures.map((f) => f.shape))),
  ];
  const tracks = shapes
    .map((shape) =>
      question.given
        .map((matrix) => {
          const figure = matrix.figures.find((f) => f.shape === shape);
          return figure ? `${figure.row},${figure.col}` : '-';
        })
        .join('>'),
    )
    .sort();
  return `fs-move|${tracks.join('#')}`;
}

/** Everything a figure series shows: paths plus orientation and colour changes. */
export function figureExactSignature(question: Question): string {
  if (question.type !== 'figure-sequence') return '';
  const matrices = question.given
    .map((matrix) =>
      matrix.figures
        .map((f) => `${f.shape}:${f.color}:${f.rotation}:${f.row}:${f.col}`)
        .sort()
        .join('|'),
    )
    .join('/');
  return `fs-exact|${matrices}`;
}

/** An equation system, independent of print order and of the letters used. */
export function equationSignature(question: Question): string {
  if (question.type !== 'math-equations') return '';
  const text = [...question.equations].sort().join(' ; ');
  return `eq|${relabel(text, /[A-D]/g)}`;
}

/** A Latin square grid plus its target field, independent of the letters used. */
export function latinSignature(question: Question): string {
  if (question.type !== 'latin-squares') return '';
  const grid = question.grid.map((row) => row.map((cell) => cell ?? '.').join('')).join('/');
  return `ls|${relabel(grid, /[A-E]/g)}|${question.target.row},${question.target.col}`;
}

/**
 * The key the generator de-duplicates on: the strictest sensible notion of
 * "same task" for each subtest.
 */
export function questionSignature(question: Question): string {
  switch (question.type) {
    case 'figure-sequence':
      return figureMovementSignature(question);
    case 'math-equations':
      return equationSignature(question);
    case 'latin-squares':
      return latinSignature(question);
  }
}

/** Every notion of sameness, for reporting. */
export function signaturesOf(question: Question): Record<string, string> {
  switch (question.type) {
    case 'figure-sequence':
      return {
        'movement path': figureMovementSignature(question),
        'exact drawing': figureExactSignature(question),
      };
    case 'math-equations':
      return {
        'equation set (letters ignored)': equationSignature(question),
        'equation set': `eq-exact|${[...question.equations].sort().join(' ; ')}`,
      };
    case 'latin-squares':
      return {
        'grid + target (letters ignored)': latinSignature(question),
        'grid + target': `ls-exact|${question.grid
          .map((row) => row.map((cell) => cell ?? '.').join(''))
          .join('/')}|${question.target.row},${question.target.col}`,
      };
  }
}
