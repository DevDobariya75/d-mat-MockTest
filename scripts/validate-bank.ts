/**
 * Validates the committed question bank without regenerating it.
 *
 *   npm run validate:bank
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateBank } from '../src/lib/validateBank';
import type { QuestionBank } from '../src/types';

const here = dirname(fileURLToPath(import.meta.url));
const bankPath = resolve(here, '../src/data/generated/tests.json');

const bank = JSON.parse(readFileSync(bankPath, 'utf8')) as QuestionBank;
const report = validateBank(bank);

console.log(`Checked ${report.questionCount} questions across ${bank.tests.length} mock tests.`);

if (!report.ok) {
  console.error(`\nValidation failed with ${report.issues.length} issue(s):`);
  for (const issue of report.issues.slice(0, 40)) {
    console.error(`  - [${issue.questionId}] ${issue.message}`);
  }
  process.exit(1);
}

console.log('Validation passed.');
