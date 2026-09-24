/**
 * Human-readable audit of the committed question bank.
 *
 *   npm run audit:bank
 *
 * Reports, and fails on:
 *  - the difficulty mix of every mock test and section,
 *  - duplicate tasks under every notion of "the same question",
 *  - whether the stated difficulty matches measurable properties,
 *  - how evenly the correct answers are spread across the options.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DIFFICULTY_PLAN, QUESTIONS_PER_SECTION, TOTAL_TESTS } from '../src/data/examSpec';
import { signaturesOf } from '../src/lib/signature';
import type { Difficulty, Question, QuestionBank } from '../src/types';

const here = dirname(fileURLToPath(import.meta.url));
const bank = JSON.parse(
  readFileSync(resolve(here, '../src/data/generated/tests.json'), 'utf8'),
) as QuestionBank;

const LEVELS: Difficulty[] = ['low', 'medium', 'high'];
const failures: string[] = [];
const fail = (message: string) => failures.push(message);

interface Entry {
  testId: number;
  sectionId: string;
  index: number;
  question: Question;
}

const entries: Entry[] = [];
for (const test of bank.tests) {
  for (const section of test.sections) {
    section.questions.forEach((question, index) => {
      entries.push({ testId: test.id, sectionId: section.id, index, question });
    });
  }
}

console.log(`dMAT question bank audit — version ${bank.version}, seed ${bank.seed}`);
console.log(`${bank.tests.length} mock tests, ${entries.length} questions\n`);

/* ------------------------------------------------------------------ *
 * 1. Difficulty mix
 * ------------------------------------------------------------------ */

const planCounts = LEVELS.map(
  (level) => DIFFICULTY_PLAN.filter((item) => item === level).length,
);

console.log('1. DIFFICULTY MIX');
console.log(
  `   Plan per section: ${LEVELS.map((level, i) => `${planCounts[i]} ${level}`).join(', ')}` +
    ` (${DIFFICULTY_PLAN.length} tasks)\n`,
);

const header = ['Test', 'Section', 'low', 'medium', 'high', 'order'];
const rows: string[][] = [];

for (const test of bank.tests) {
  for (const section of test.sections) {
    const counts = LEVELS.map(
      (level) => section.questions.filter((q) => q.difficulty === level).length,
    );
    const order = section.questions.map((q) => q.difficulty);
    const orderOk = order.every((level, i) => level === DIFFICULTY_PLAN[i]);

    rows.push([
      String(test.id),
      section.id,
      String(counts[0]),
      String(counts[1]),
      String(counts[2]),
      orderOk ? 'easy→hard ok' : 'WRONG ORDER',
    ]);

    if (section.questions.length !== QUESTIONS_PER_SECTION) {
      fail(`test ${test.id} / ${section.id}: ${section.questions.length} questions`);
    }
    LEVELS.forEach((level, i) => {
      if (counts[i] !== planCounts[i]) {
        fail(
          `test ${test.id} / ${section.id}: ${counts[i]} ${level} questions, expected ${planCounts[i]}`,
        );
      }
    });
    if (!orderOk) fail(`test ${test.id} / ${section.id}: difficulty is not ordered easy to hard`);
  }
}

const widths = header.map((_, col) =>
  Math.max(header[col]!.length, ...rows.map((row) => row[col]!.length)),
);
const line = (cells: string[]) =>
  '   ' + cells.map((cell, col) => cell.padEnd(widths[col]!)).join('  ');
console.log(line(header));
console.log('   ' + widths.map((w) => '-'.repeat(w)).join('  '));
for (const row of rows) console.log(line(row));

const totals = LEVELS.map(
  (level) => entries.filter((entry) => entry.question.difficulty === level).length,
);
console.log(
  `\n   Whole bank: ${LEVELS.map((level, i) => `${totals[i]} ${level}`).join(', ')}` +
    ` = ${totals.reduce((a, b) => a + b, 0)}\n`,
);

/* ------------------------------------------------------------------ *
 * 2. Uniqueness
 * ------------------------------------------------------------------ */

console.log('2. UNIQUENESS');

// Question ids.
const ids = new Map<string, number>();
for (const entry of entries) ids.set(entry.question.id, (ids.get(entry.question.id) ?? 0) + 1);
const repeatedIds = [...ids].filter(([, count]) => count > 1);
if (repeatedIds.length > 0) fail(`${repeatedIds.length} duplicate question id(s)`);
console.log(`   Question ids: ${ids.size} distinct of ${entries.length}`);

// Every notion of sameness, per subtest.
const notions = new Map<string, Map<string, Entry[]>>();
for (const entry of entries) {
  for (const [notion, signature] of Object.entries(signaturesOf(entry.question))) {
    const label = `${entry.sectionId} — ${notion}`;
    if (!notions.has(label)) notions.set(label, new Map());
    const groups = notions.get(label)!;
    if (!groups.has(signature)) groups.set(signature, []);
    groups.get(signature)!.push(entry);
  }
}

for (const [label, groups] of [...notions].sort()) {
  const total = [...groups.values()].reduce((sum, group) => sum + group.length, 0);
  const dups = [...groups.values()].filter((group) => group.length > 1);
  const extra = dups.reduce((sum, group) => sum + group.length - 1, 0);
  const status = extra === 0 ? 'all distinct' : `${extra} REPEAT(S)`;
  console.log(`   ${label.padEnd(52)} ${String(groups.size).padStart(3)}/${total}  ${status}`);

  if (extra > 0) {
    fail(`${label}: ${extra} repeated task(s)`);
    for (const group of dups.slice(0, 5)) {
      console.log(`      x${group.length}: ${group.map((e) => e.question.id).join(', ')}`);
    }
  }
}

// Byte-level identity, ignoring the id.
const byBytes = new Map<string, Entry[]>();
for (const entry of entries) {
  const { id: _id, ...rest } = entry.question;
  const key = JSON.stringify(rest);
  if (!byBytes.has(key)) byBytes.set(key, []);
  byBytes.get(key)!.push(entry);
}
const byteDups = [...byBytes.values()].filter((group) => group.length > 1);
if (byteDups.length > 0) fail(`${byteDups.length} byte-identical question group(s)`);
console.log(
  `   ${'whole bank — byte-identical'.padEnd(52)} ${String(byBytes.size).padStart(3)}/${entries.length}  ${
    byteDups.length === 0 ? 'all distinct' : 'REPEATS'
  }`,
);
console.log();

/* ------------------------------------------------------------------ *
 * 3. Does the label match the task?
 * ------------------------------------------------------------------ */

console.log('3. DIFFICULTY IS REAL, NOT JUST LABELLED');

const measure = (question: Question): number => {
  switch (question.type) {
    case 'figure-sequence':
      return question.given[0]!.figures.length;
    case 'math-equations':
      return question.variables.length;
    case 'latin-squares':
      return question.explanation.length;
  }
};

const metricName: Record<string, string> = {
  'figure-sequences': 'figures per matrix',
  'mathematical-equations': 'unknowns',
  'latin-squares': 'deduction steps',
};

for (const sectionId of Object.keys(metricName)) {
  const parts: string[] = [];
  let previousMax = -Infinity;
  for (const level of LEVELS) {
    const values = entries
      .filter((e) => e.sectionId === sectionId && e.question.difficulty === level)
      .map((e) => measure(e.question));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    parts.push(`${level} ${min}-${max} (mean ${mean.toFixed(1)}, n=${values.length})`);
    if (min < previousMax) {
      fail(`${sectionId}: ${level} tasks overlap downwards on ${metricName[sectionId]}`);
    }
    previousMax = min;
  }
  console.log(`   ${sectionId.padEnd(24)} ${metricName[sectionId]!.padEnd(18)} ${parts.join(' | ')}`);
}

// Latin squares: fewer clues as the level rises.
const clueCounts = LEVELS.map((level) => {
  const values = entries
    .filter((e) => e.sectionId === 'latin-squares' && e.question.difficulty === level)
    .map((e) =>
      e.question.type === 'latin-squares'
        ? e.question.grid.flat().filter((cell) => cell !== null).length
        : 0,
    );
  return { level, min: Math.min(...values), max: Math.max(...values) };
});
console.log(
  `   ${'latin-squares'.padEnd(24)} ${'clues on the grid'.padEnd(18)} ` +
    clueCounts.map((c) => `${c.level} ${c.min}-${c.max}`).join(' | '),
);
for (let i = 1; i < clueCounts.length; i += 1) {
  if (clueCounts[i]!.max > clueCounts[i - 1]!.min) {
    fail('latin-squares: harder levels do not consistently have fewer clues');
  }
}
console.log();

/* ------------------------------------------------------------------ *
 * 4. Answer spread
 * ------------------------------------------------------------------ */

console.log('4. ANSWER SPREAD (a guessable bank would be lopsided)');

const figureAnswers = [0, 0, 0];
for (const entry of entries) {
  if (entry.question.type !== 'figure-sequence') continue;
  for (const index of entry.question.answer) figureAnswers[index!] += 1;
}
console.log(
  `   figure sequences  correct option: ` +
    figureAnswers.map((n, i) => `Matrix ${i + 1} ${n}`).join(', ') +
    ` (of ${figureAnswers.reduce((a, b) => a + b, 0)} blanks)`,
);

const latinAnswers = new Map<string, number>();
for (const entry of entries) {
  if (entry.question.type !== 'latin-squares') continue;
  latinAnswers.set(entry.question.answer, (latinAnswers.get(entry.question.answer) ?? 0) + 1);
}
console.log(
  `   latin squares     correct letter: ` +
    [...latinAnswers].sort().map(([letter, n]) => `${letter} ${n}`).join(', '),
);

const spread = (counts: number[]) => {
  const total = counts.reduce((a, b) => a + b, 0);
  const expected = total / counts.length;
  return Math.max(...counts.map((n) => Math.abs(n - expected) / expected));
};
const figureSkew = spread(figureAnswers);
const latinSkew = spread([...latinAnswers.values()]);
console.log(
  `   worst deviation from even: figures ${(figureSkew * 100).toFixed(0)}%, ` +
    `latin squares ${(latinSkew * 100).toFixed(0)}%`,
);
if (figureSkew > 0.25) fail(`figure-sequence answers are skewed by ${(figureSkew * 100).toFixed(0)}%`);
if (latinSkew > 0.35) fail(`latin-square answers are skewed by ${(latinSkew * 100).toFixed(0)}%`);
console.log();

/* ------------------------------------------------------------------ *
 * Verdict
 * ------------------------------------------------------------------ */

if (bank.tests.length !== TOTAL_TESTS) {
  fail(`expected ${TOTAL_TESTS} mock tests, found ${bank.tests.length}`);
}

if (failures.length > 0) {
  console.error(`AUDIT FAILED — ${failures.length} issue(s):`);
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}

console.log('AUDIT PASSED — difficulty mix correct, every task distinct.');
