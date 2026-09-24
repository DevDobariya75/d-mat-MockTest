import { GRID_SIZE } from '@/data/examSpec';
import { describeFigure, FigureGlyph } from '@/components/FigureGlyph';
import { cx } from '@/components/ui';
import type { FigureMatrix } from '@/types';

/**
 * One 4x4 matrix of a figure series, drawn as a CSS grid of bordered cells so
 * it scales cleanly from the compact option tiles to the large question view.
 */

export type MatrixScale = 'sm' | 'md' | 'lg';

const CELL_SIZE: Record<MatrixScale, string> = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-11 w-11',
};

const GLYPH_SIZE: Record<MatrixScale, number> = { sm: 16, md: 22, lg: 30 };

export function FigureMatrixView({
  matrix,
  scale = 'md',
  label,
  className,
}: {
  matrix: FigureMatrix;
  scale?: MatrixScale;
  label?: string;
  className?: string;
}) {
  const byCell = new Map<string, FigureMatrix['figures'][number]>();
  for (const figure of matrix.figures) byCell.set(`${figure.row},${figure.col}`, figure);

  const description = label
    ? `${label}: ${matrix.figures.map(describeFigure).join('; ')}`
    : matrix.figures.map(describeFigure).join('; ');

  return (
    <div className={cx('inline-block', className)}>
      <div
        className="grid overflow-hidden rounded-[3px] border-2 border-ink-800 bg-white"
        style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
        role="img"
        aria-label={description}
      >
        {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
          const row = Math.floor(index / GRID_SIZE);
          const col = index % GRID_SIZE;
          const figure = byCell.get(`${row},${col}`);
          return (
            <div
              key={index}
              className={cx(
                'flex items-center justify-center border-ink-400',
                CELL_SIZE[scale],
                col < GRID_SIZE - 1 && 'border-r',
                row < GRID_SIZE - 1 && 'border-b',
              )}
            >
              {figure ? <FigureGlyph figure={figure} size={GLYPH_SIZE[scale]} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The placeholder shown in the series where a matrix has to be determined. */
export function UnknownMatrixView({
  scale = 'md',
  label,
}: {
  scale?: MatrixScale;
  label: string;
}) {
  const side = scale === 'lg' ? 'h-[180px] w-[180px]' : scale === 'md' ? 'h-[136px] w-[136px]' : 'h-[104px] w-[104px]';
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center rounded-[3px] border-2 border-dashed border-brand-400 bg-brand-50/60',
        side,
      )}
      role="img"
      aria-label={`${label}: unknown matrix`}
    >
      <span className="text-3xl font-bold text-brand-600">?</span>
      <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-brand-600">
        {label}
      </span>
    </div>
  );
}
