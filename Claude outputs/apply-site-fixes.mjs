#!/usr/bin/env node
/**
 * apply-site-fixes.mjs — תיקוני אתר חד-פעמיים, בטוחים להרצה חוזרת.
 *
 * הרצה מתוך תיקיית הריפו:  node apply-site-fixes.mjs
 *
 * מה הוא עושה:
 *   1. כפתורי "וואטסאפ" בכל האתר הם <button> בלי שום פעולה מאחוריהם —
 *      לחיצה עליהם לא עושה כלום. ממיר אותם לקישור אמיתי אל wa.me.
 *   2. guides/price.html (התבנית שממנה נבנים המאמרים מאופנלי) חסרים בה
 *      כפתור טלפון ליד הוואטסאפ, ושורת קרדיט תחתונה. מוסיף את שניהם.
 *
 * הרצה שנייה לא תשנה כלום.
 */

import fs from 'node:fs';
import path from 'node:path';

const WA = 'https://wa.me/972506890650';
const PHONE_HREF = 'tel:0506890650';
const PHONE_TEXT = '050-6890650';
const TEMPLATE = path.join('guides', 'price.html');

const log = (...a) => console.log('[fix]', ...a);

// ----------------------------------------------------------------------------

function htmlFiles(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) htmlFiles(p, acc);
    else if (e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

// 1) כפתור וואטסאפ מת -> קישור
const DEAD_WA = /<button\b((?:(?!<\/button>).)*?)>((?:(?!<\/button>).)*?WhatsApp(?:(?!<\/button>).)*?)<\/button>/gs;

function fixWhatsappButtons() {
  const fixed = [];
  for (const file of htmlFiles('.')) {
    const src = fs.readFileSync(file, 'utf8');
    if (!DEAD_WA.test(src)) { DEAD_WA.lastIndex = 0; continue; }
    DEAD_WA.lastIndex = 0;

    const out = src.replace(DEAD_WA, (_m, attrs, inner) => {
      const cls = /class="([^"]*)"/.exec(attrs)?.[1] ?? '';
      const style = /style="([^"]*)"/.exec(attrs)?.[1];
      const styleAttr = style ? ` style="${style}"` : '';
      return `<a href="${WA}" target="_blank" rel="noopener noreferrer" `
        + `aria-label="פנייה בוואטסאפ" class="${cls}"${styleAttr}>${inner}</a>`;
    });

    if (out !== src) { fs.writeFileSync(file, out, 'utf8'); fixed.push(file); }
  }
  log(`כפתורי וואטסאפ שהומרו לקישור: ${fixed.length}`);
  fixed.forEach((f) => log('   ', f));
}

// 2) התבנית: כפתור טלפון + שורת קרדיט
function fixTemplate() {
  if (!fs.existsSync(TEMPLATE)) { log(`לא נמצא ${TEMPLATE} — מדלג`); return; }
  let s = fs.readFileSync(TEMPLATE, 'utf8');
  const before = s;

  // --- כפתור טלפון לצד הוואטסאפ בקריאה לפעולה שבסוף הדף ---
  const cta = /(<div class="mt-16 bg-telem-dark[^"]*">)([\s\S]*?)(<\/div>\s*<\/article>)/.exec(s);
  if (!cta) {
    log('לא נמצאה הקריאה לפעולה בתבנית — מדלג על כפתור הטלפון');
  } else if (cta[2].includes('href="tel:')) {
    log('כפתור הטלפון כבר קיים בתבנית');
  } else {
    const wa = /<a href="https:\/\/wa\.me\/[^"]*"[\s\S]*?<\/a>/.exec(cta[2]);
    if (!wa) {
      log('לא נמצא קישור וואטסאפ בקריאה לפעולה — מדלג על כפתור הטלפון');
    } else {
      const waHtml = wa[0].replace(' mx-auto', '');
      const telHtml = `<a href="${PHONE_HREF}" class="border-2 border-telem-khaki text-white `
        + 'px-10 py-4 rounded-2xl font-black text-xl hover:bg-white/10 transition-all font-sans '
        + `not-italic uppercase tracking-tighter flex items-center justify-center">${PHONE_TEXT}</a>`;
      const row = '<div class="flex flex-col sm:flex-row gap-4 justify-center items-center">'
        + waHtml + telHtml + '</div>';
      const block = cta[2].slice(0, wa.index) + row + cta[2].slice(wa.index + wa[0].length);
      s = s.slice(0, cta.index + cta[1].length) + block + s.slice(cta.index + cta[1].length + cta[2].length);
      log('נוסף כפתור טלפון לקריאה לפעולה');
    }
  }

  // --- שורת קרדיט תחתונה, כמו בשאר עמודי המדריכים ---
  if (s.includes('<footer')) {
    log('שורת הקרדיט כבר קיימת בתבנית');
  } else if (!s.includes('</main>')) {
    log('לא נמצא סוף התוכן בתבנית — מדלג על שורת הקרדיט');
  } else {
    const footer = '<footer class="bg-telem-dark text-white py-16 px-4 text-center '
      + 'border-t border-telem-forest/30 font-serif italic mt-20">'
      + '<p class="text-sm opacity-30 italic tracking-widest uppercase italic font-serif">'
      + '© 2026 תלם - ניהול סביבה ופסולת. כל הזכויות שמורות.</p></footer>';
    s = s.replace('</main>', `</main>${footer}`);
    log('נוספה שורת קרדיט תחתונה');
  }

  if (s !== before) fs.writeFileSync(TEMPLATE, s, 'utf8');
}

// ----------------------------------------------------------------------------

if (!fs.existsSync('guides') || !fs.existsSync('scripts')) {
  console.error('[fix] ✗ יש להריץ מתוך תיקיית האתר (זו שבה יושבות guides ו-scripts).');
  process.exit(1);
}

fixWhatsappButtons();
fixTemplate();
log('סיום.');
