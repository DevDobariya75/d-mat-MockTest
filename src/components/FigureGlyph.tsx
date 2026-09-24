import type { Figure, FigureColor, FigureShape } from '@/types';

/**
 * SVG glyphs for the Figure Sequences subtest.
 *
 * Shapes are drawn inside a 0..100 box so a single `rotate` transform around
 * the centre expresses the "rotates around its own axis" rule. Every glyph
 * keeps a dark outline so that white and yellow figures stay visible against
 * the white matrix.
 */

export const FIGURE_FILL: Record<FigureColor, string> = {
  blue: '#1d6fb8',
  yellow: '#f5d90a',
  pink: '#e879b0',
  green: '#12866b',
  orange: '#e2751b',
  black: '#1f2738',
  white: '#ffffff',
};

export const FIGURE_COLOR_LABEL: Record<FigureColor, string> = {
  blue: 'blue',
  yellow: 'yellow',
  pink: 'pink',
  green: 'green',
  orange: 'orange',
  black: 'black',
  white: 'white',
};

/** Shapes whose orientation is visible; used for the accessible label. */
const ORIENTED: FigureShape[] = ['triangle', 'arrow', 'arc', 'bracket'];

function shapeElement(shape: FigureShape): React.ReactElement {
  switch (shape) {
    case 'square':
      return <rect x={22} y={22} width={56} height={56} rx={4} />;
    case 'diamond':
      return <polygon points="50,14 86,50 50,86 14,50" />;
    case 'hexagon':
      return <polygon points="30,18 70,18 90,50 70,82 30,82 10,50" />;
    case 'triangle':
      return <polygon points="50,14 88,84 12,84" />;
    case 'circle':
      return <circle cx={50} cy={50} r={30} />;
    case 'arrow':
      return <polygon points="12,36 58,36 58,16 92,50 58,84 58,64 12,64" />;
    case 'arc':
      // A thick semicircle opening downwards.
      return <path d="M12 72 A38 38 0 0 1 88 72 L68 72 A18 18 0 0 0 32 72 Z" />;
    case 'bracket':
      // The flag-like glyph of the official materials.
      return <polygon points="16,18 84,18 84,42 46,42 46,82 16,82" />;
  }
}

export function FigureGlyph({ figure, size = 26 }: { figure: Figure; size?: number }) {
  const fill = FIGURE_FILL[figure.color];
  const stroke = figure.color === 'black' ? '#000000' : '#1f2738';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className="block"
    >
      <g
        transform={`rotate(${figure.rotation} 50 50)`}
        fill={fill}
        stroke={stroke}
        strokeWidth={7}
        strokeLinejoin="round"
      >
        {shapeElement(figure.shape)}
      </g>
    </svg>
  );
}

export function describeFigure(figure: Figure): string {
  const orientation = ORIENTED.includes(figure.shape) ? `, rotated ${figure.rotation} degrees` : '';
  return `${FIGURE_COLOR_LABEL[figure.color]} ${figure.shape}${orientation}, row ${figure.row + 1}, column ${figure.col + 1}`;
}
