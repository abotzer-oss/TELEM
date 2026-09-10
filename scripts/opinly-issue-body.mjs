#!/usr/bin/env node
/**
 * opinly-issue-body.mjs — בונה גוף Issue מקובץ הסיכום של opinly-sync.
 *
 * הרצה:  node scripts/opinly-issue-body.mjs <summary.json> <body.md>
 * סביבה: RUN_URL — קישור להרצת ה-workflow
 *
 * מדפיס את כותרת ה-Issue ל-stdout. אם אין מה לדווח — לא מדפיס כלום
 * ולא כותב קובץ, וה-workflow מדלג על פתיחת ה-Issue.
 */

import fs from 'node:fs';

const [summaryPath, bodyPath] = process.argv.slice(2);
const runUrl = process.env.RUN_URL || '';

if (!fs.existsSync(summaryPath)) process.exit(0);

const { created = [], skipped = [] } = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
if (created.length === 0 && skipped.length === 0) process.exit(0);

// סוגריים מרובעים בכותרת שוברים קישור markdown
const linkText = (s) => String(s).replace(/[[\]]/g, '');

const lines = [];

if (created.length > 0) {
  lines.push(`## דפים חדשים (${created.length})`, '');
  for (const p of created) lines.push(`- [${linkText(p.title)}](${p.url})`);
  lines.push('');
}

if (skipped.length > 0) {
  lines.push(`## פוסטים שדולגו (${skipped.length})`, '');
  for (const p of skipped) lines.push(`- ${p.title} — ${p.reason}`);
  lines.push('');
}

lines.push('---', '', `[הרצה מלאה ב-Actions](${runUrl})`);

fs.writeFileSync(bodyPath, lines.join('\n') + '\n', 'utf8');

const title = created.length > 0
  ? `סנכרון אופנלי: ${created.length} דפים חדשים`
  : `סנכרון אופנלי: ${skipped.length} דפים דולגו`;

process.stdout.write(title);
