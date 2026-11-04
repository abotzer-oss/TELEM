/**
 * internal-links.mjs — קישורים פנימיים שנשמרים גם אחרי סנכרון מאופנלי.
 *
 * גוף המאמרים שמגיעים מאופנלי נבנה מחדש בכל ריצה של opinly-sync, ולכן קישור
 * שנוסף ביד ל-HTML נמחק בריצה הבאה. הכללים ב-internal-links.json מוחלים על
 * גוף המאמר אחרי הבנייה, כך שהקישורים חוזרים בכל ריצה.
 *
 * כלל link:  { "context": "...", "anchor": "...", "href": "/..." }
 *   context — קטע טקסט (HTML כפי שיוצא מהבנייה) שמופיע פעם אחת בדיוק בגוף.
 *   anchor  — החלק בתוך context שהופך לקישור.
 * כלל append: { "find": "...", "replace": "..." } — משפט קצר שנוסף לגוף.
 *
 * כלל שלא נמצא (התוכן באופנלי השתנה) מדולג עם אזהרה, ולא מפיל את הריצה.
 */
import fs from 'node:fs';

const LINK_CLASS = 'text-telem-forest font-bold hover:underline';

export function loadRules(file = new URL('./internal-links.json', import.meta.url)) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function count(hay, needle) {
  let n = 0;
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) n += 1;
  return n;
}

function insideAnchor(html, idx) {
  return html.lastIndexOf('<a ', idx) > html.lastIndexOf('</a>', idx);
}

export function applyInternalLinks(body, slug, rules, warn = () => {}) {
  const list = rules?.[slug];
  if (!Array.isArray(list)) return body;
  let out = body;
  for (const r of list) {
    if (r.find !== undefined) {
      if (count(out, r.find) !== 1) { warn(`${slug}: append "${r.find.slice(0, 40)}…" לא נמצא פעם אחת — דולג`); continue; }
      out = out.replace(r.find, () => r.replace);
      continue;
    }
    const n = count(out, r.context);
    if (n !== 1) { warn(`${slug}: "${r.context.slice(0, 40)}…" נמצא ${n} פעמים — הקישור ל-${r.href} דולג`); continue; }
    const i = out.indexOf(r.context);
    if (insideAnchor(out, i)) { warn(`${slug}: "${r.anchor}" כבר בתוך קישור — דולג`); continue; }
    const j = i + r.context.indexOf(r.anchor);
    if (j < i) { warn(`${slug}: anchor לא נמצא בתוך context — דולג`); continue; }
    out = `${out.slice(0, j)}<a href="${r.href}" class="${LINK_CLASS}">${r.anchor}</a>${out.slice(j + r.anchor.length)}`;
  }
  return out;
}
