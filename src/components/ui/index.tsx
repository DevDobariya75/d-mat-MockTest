import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export const cx = (...parts: (string | false | null | undefined)[]): string =>
  parts.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ *
 * Button
 * ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600 disabled:bg-brand-300',
  secondary:
    'bg-ink-800 text-white hover:bg-ink-900 focus-visible:outline-ink-800 disabled:bg-ink-400',
  outline:
    'border border-ink-300 bg-white text-ink-800 hover:border-ink-400 hover:bg-ink-50 focus-visible:outline-ink-500 disabled:text-ink-400',
  ghost:
    'text-ink-700 hover:bg-ink-100 focus-visible:outline-ink-400 disabled:text-ink-300',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600 disabled:bg-red-300',
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

const buttonClasses = (
  variant: ButtonVariant,
  size: ButtonSize,
  className?: string,
): string =>
  cx(
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
    'disabled:cursor-not-allowed',
    BUTTON_VARIANT[variant],
    BUTTON_SIZE[size],
    className,
  );

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...rest} />;
}

/** A router link that looks exactly like a `Button`. */
export function LinkButton({
  to,
  variant = 'primary',
  size = 'md',
  className,
  replace,
  children,
}: {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  replace?: boolean;
  children: ReactNode;
}) {
  return (
    <Link to={to} replace={replace} className={buttonClasses(variant, size, className)}>
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ *
 * Card
 * ------------------------------------------------------------------ */

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        'rounded-xl border border-ink-200 bg-white shadow-card',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Badge
 * ------------------------------------------------------------------ */

type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        BADGE_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Progress bar
 * ------------------------------------------------------------------ */

export function ProgressBar({
  value,
  label,
  tone = 'brand',
}: {
  /** Fraction in [0, 1]. */
  value: number;
  label?: string;
  tone?: 'brand' | 'success' | 'warning' | 'danger';
}) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const fill =
    tone === 'success'
      ? 'bg-emerald-500'
      : tone === 'warning'
        ? 'bg-amber-500'
        : tone === 'danger'
          ? 'bg-red-500'
          : 'bg-brand-600';
  return (
    <div>
      {label ? (
        <div className="mb-1 flex items-baseline justify-between text-xs font-medium text-ink-500">
          <span>{label}</span>
          <span>{percent}%</span>
        </div>
      ) : null}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-ink-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label ?? 'Progress'}
      >
        <div className={cx('h-full rounded-full transition-all', fill)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Modal
 * ------------------------------------------------------------------ */

export function Modal({
  open,
  title,
  children,
  footer,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Omit to make the dialog non-dismissable, as during a running section. */
  onClose?: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-lg rounded-xl border border-ink-200 bg-white shadow-card"
      >
        <div className="border-b border-ink-200 px-5 py-4">
          <h2 className="text-lg font-bold text-ink-900">{title}</h2>
        </div>
        <div className="px-5 py-4 text-sm leading-relaxed text-ink-700">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-ink-200 px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Section header
 * ------------------------------------------------------------------ */

export function SectionHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-wider text-brand-600">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{title}</h1>
        {description ? <div className="mt-2 max-w-3xl text-sm text-ink-600">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Stat tile
 * ------------------------------------------------------------------ */

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'brand';
}) {
  const valueTone =
    tone === 'success'
      ? 'text-emerald-600'
      : tone === 'danger'
        ? 'text-red-600'
        : tone === 'warning'
          ? 'text-amber-600'
          : tone === 'brand'
            ? 'text-brand-600'
            : 'text-ink-900';
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className={cx('mt-1 text-2xl font-bold tabular-nums', valueTone)}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}
