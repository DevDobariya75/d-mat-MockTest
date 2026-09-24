/**
 * The solution path shown after a question is answered.
 *
 * Mirrors the "Solution path" bullet lists of the official solution keys: one
 * line per figure rule, per substitution step, or per deduction.
 */
export function Explanation({
  lines,
  title = 'Solution path',
}: {
  lines: string[];
  title?: string;
}) {
  if (lines.length === 0) return null;
  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/70 px-4 py-3">
      <h4 className="text-xs font-bold uppercase tracking-wide text-sky-800">{title}</h4>
      <ul className="mt-2 space-y-1.5">
        {lines.map((line, index) => (
          <li key={index} className="flex gap-2 text-sm leading-relaxed text-ink-700">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500"
              aria-hidden="true"
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
