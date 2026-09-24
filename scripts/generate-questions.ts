/**
 * Generates the whole question bank and writes it to
 * `src/data/generated/tests.json`, then validates the result.
 *
 *   npm run generate:questions
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBank, DEFAULT_SEED } from '../src/lib/buildBank';
import { validateBank } from '../src/lib/validateBank';

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(here, '../src/data/generated/tests.json');

const seedArg = process.argv.find((arg: string) => arg.startsWith('--seed='));
const seed = seedArg ? Number(seedArg.split('=')[1]) : DEFAULT_SEED;

console.log(`Generating question bank (seed ${seed})...`);
const startedAt = Date.now();
const bank = buildBank(seed);
const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

const report = validateBank(bank);
console.log(`Generated ${report.questionCount} questions in ${elapsed}s.`);

if (!report.ok) {
  console.error(`\nValidation failed with ${report.issues.length} issue(s):`);
  for (const issue of report.issues.slice(0, 40)) {
    console.error(`  - [${issue.questionId}] ${issue.message}`);
  }
  if (report.issues.length > 40) {
    console.error(`  ... and ${report.issues.length - 40} more`);
  }
  process.exit(1);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(bank)}\n`, 'utf8');

const summary = bank.tests.map((test) => ({
  test: test.id,
  ...Object.fromEntries(test.sections.map((section) => [section.id, section.questions.length])),
}));
console.table(summary);
console.log(`Validation passed. Wrote ${outputPath}`);
