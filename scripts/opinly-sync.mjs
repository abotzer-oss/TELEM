#!/usr/bin/env node
/**
 * opinly-sync.mjs — מושך פוסטים שפורסמו מאופנלי ובונה מהם דפי HTML
 * בשפה העיצובית של telemenv.co.il.
 *
 * הרצה:  node scripts/opinly-sync.mjs
 * דרוש:  OPINLY_API_KEY  (מפתח sk-, מתוך GitHub Secrets — לעולם לא בקוד)
 *
 * דגלים:
 *   --dry-run     מריץ הכל בלי לכתוב קבצים
 *   --force       מרשה דריסה של קובץ שאינו במניפסט (השתמש בזהירות)
 *
 * מבנה ה-API (לפי מפרט ה-OpenAPI הרשמי של אופנלי):
 *   GET /v1/content/posts        -> { data: Post[], has_more, next_cursor }
 *                                   Post = כרטיס בלבד: slug, title, description,
 *                                   firstPublishedAt, lastPublishedAt, image,
 *                                   category, author, tags.  אין שדה status —
 *                                   הנקודה הזו מחזירה ממילא רק פוסטים שפורסמו.
 *   GET /v1/content/post?slug=   -> FullPost, ובו content כעץ צמתים (לא מארקדאון).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// ----------------------------------------------------------------------------
// הגדרות
// ----------------------------------------------------------------------------

const CONFIG = {
  apiBase: process.env.OPINLY_API_BASE || 'https://sdk.opinly.ai/v1',
  siteUrl: 'https://telemenv.co.il',
  outDir: 'guides',                        // הפוסטים נוחתים כאן
  templateFile: 'guides/price.html',       // הדף שממנו נלקחת השפה העיצובית
  manifestFile: 'guides/.opinly-manifest.json',
  imagesPrefix: process.env.OPINLY_IMAGES_PREFIX || '',  // בסיס לתמונות לפי fileKey
  breadcrumbParent: { name: 'מרכז ידע', url: '/guides/' },
  author: {
    name: 'אבירם בוצר',
    id: 'https://telemenv.co.il/#aviram',
    url: 'https://telemenv.co.il/about.html',
  },
  publisher: {
    name: 'תלם ניהול סביבה',
    url: 'https://telemenv.co.il',
    logo: 'https://telemenv.co.il/logo.png',
  },
};

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

// סיכום הריצה לצריכת ה-workflow. נכתב מחוץ למאגר — בתיקייה הזמנית של הריצה.
const SUMMARY_FILE = path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'opinly-summary.json');

// ----------------------------------------------------------------------------
// עזרים
// ----------------------------------------------------------------------------

const log = (...a) => console.log('[opinly]', ...a);
const warn = (...a) => console.warn('[opinly] ⚠ ', ...a);

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * עוטף רצפים לטיניים/מספריים בתוך טקסט עברי ב-<bdi>.
 * זה מה שמונע מ-"Phase II" או מנקודה בסוף משפט לקפוץ למקום הלא נכון.
 * פועל רק על צמתי טקסט — לא נוגע בתגיות, בקישורים או בקוד.
 */
function isolateLatin(html) {
  // מוגן: בלוקי קוד/סקריפט, תגיות, וישויות HTML (&quot; &amp; &#8211; וכו')
  const PROTECT = /(<(?:script|style|code|pre)[\s\S]*?<\/(?:script|style|code|pre)>|<[^>]+>|&(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#[xX][0-9a-fA-F]{1,6});)/g;
  // רצף לטיני: אותיות/ספרות לועזיות עם רווחים, נקודות, מקפים וסלאשים בפנים
  const LATIN = /([A-Za-z][A-Za-z0-9]*(?:[ .\-/&][A-Za-z0-9]+)*)/g;

  // ההחלטה היא ברמת המסמך ולא ברמת קטע הטקסט: ב"Phase II" שיושב בתוך <strong>
  // אין אות עברית משלו, אבל הוא בהחלט בתוך פסקה עברית וצריך בידוד.
  if (!/[\u0590-\u05FF]/.test(html)) return html;

  return html
    .split(PROTECT)
    .map((chunk, i) => (i % 2 === 1 ? chunk : chunk.replace(LATIN, '<bdi>$1</bdi>')))
    .join('');
}

/** מנקה ומאחד מונחי Phase לצורה אחת (ספרות רומיות). */
function normalizeTerms(html) {
  return html
    .replace(/\bPhase\s*1\b/g, 'Phase I')
    .replace(/\bPhase\s*2\b/g, 'Phase II')
    .replace(/\bPhase\s*3\b/g, 'Phase III');
}

/** מוודא ש-slug תקין: לטיני, מקפים, בלי רווחים/עברית/קו תחתון. */
function safeSlug(slug, title) {
  let s = String(slug || '').trim().toLowerCase();
  s = s.replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!s || s === 'post' || s.length < 4) {
    warn(`slug בעייתי ("${slug}") עבור "${title}" — הפוסט מדולג. תקן אותו באופנלי.`);
    return null;
  }
  return s;
}

// ----------------------------------------------------------------------------
// שליפה מאופנלי
// ----------------------------------------------------------------------------

async function apiGet(apiKey, pathname, params = {}) {
  const url = new URL(`${CONFIG.apiBase}${pathname}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Opinly API ${res.status} ${res.statusText} על ${pathname} — ${await res.text()}`);
  }
  return res.json();
}

/**
 * רשימת הפוסטים שפורסמו. מחזירה "כרטיסים" בלבד — בלי גוף המאמר.
 * אין צורך לסנן לפי סטטוס: הנקודה הזו מחזירה רק פוסטים שפורסמו.
 */
async function fetchPublishedPosts(apiKey) {
  const posts = [];
  let cursor = null;

  do {
    const data = await apiGet(apiKey, '/content/posts', { limit: 50, cursor });
    const batch = data.data ?? data.posts ?? data.items ?? [];
    posts.push(...batch);
    cursor = data.next_cursor ?? data.nextCursor ?? null;
  } while (cursor);

  return posts;
}

/** הפוסט המלא לפי slug — כאן נמצא גוף המאמר. */
async function fetchFullPost(apiKey, slug) {
  const data = await apiGet(apiKey, '/content/post', { slug });
  return data.data ?? data.post ?? data;
}

// ----------------------------------------------------------------------------
// המרת עץ התוכן של אופנלי ל-HTML
// ----------------------------------------------------------------------------

/** משווה שמות צמתים בלי תלות ב-camelCase / snake_case. */
const norm = (t) => String(t || '').toLowerCase().replace(/[_-]/g, '');

/**
 * מחזיר כתובת תמונה. מקבל מחרוזת, אובייקט attrs של צומת, או אובייקט תמונה
 * של אופנלי ({ fileKey, altText, ... }) — לכל אחד מהם יש צורה אחרת.
 */
function imageSrc(input) {
  let raw = input;
  for (let depth = 0; raw && typeof raw === 'object' && depth < 3; depth += 1) {
    raw = raw.src ?? raw.url ?? raw.fileKey ?? raw.file_key ?? raw.key ?? raw.image ?? '';
  }
  if (typeof raw !== 'string' || !raw) return '';
  if (/^(https?:)?\/\//.test(raw) || raw.startsWith('/')) return raw;
  if (CONFIG.imagesPrefix) return CONFIG.imagesPrefix.replace(/\/$/, '') + '/' + raw;
  warn(`תמונה עם fileKey "${raw}" ואין OPINLY_IMAGES_PREFIX — התמונה מדולגת.`);
  return '';
}

/** עוטף טקסט בסימוני עיצוב (bold / italic / link / code ...). */
function applyMarks(text, marks = []) {
  let out = text;
  for (const mark of marks) {
    const attrs = mark.attrs || {};
    switch (norm(mark.type)) {
      case 'bold': case 'strong':
        out = `<strong>${out}</strong>`; break;
      case 'italic': case 'em':
        out = `<em>${out}</em>`; break;
      case 'underline':
        out = `<u>${out}</u>`; break;
      case 'strike': case 'strikethrough':
        out = `<s>${out}</s>`; break;
      case 'code':
        out = `<code>${out}</code>`; break;
      case 'link': {
        const href = escapeHtml(attrs.href || attrs.url || '#');
        const ext = /^https?:\/\//.test(href) && !href.includes('telemenv.co.il');
        const rel = ext ? ' rel="noopener" target="_blank"' : '';
        out = `<a href="${href}"${rel}>${out}</a>`; break;
      }
      default: break; // textStyle וכיוצא בו — מתעלמים, העיצוב מגיע מהאתר
    }
  }
  return out;
}

function renderNodes(nodes = []) {
  return nodes.map(renderNode).join('');
}

/** פסקה יחידה בתוך <li> או תא טבלה — בלי <p> מיותר סביבה. */
function unwrapSingleParagraph(kids = []) {
  if (kids.length === 1 && norm(kids[0].type) === 'paragraph') {
    return renderNodes(kids[0].content || []);
  }
  return renderNodes(kids);
}

function renderNode(node) {
  if (!node || typeof node !== 'object') return '';
  const kids = node.content || [];

  switch (norm(node.type)) {
    case 'doc':
      return renderNodes(kids);

    case 'text':
      return applyMarks(escapeHtml(node.text || ''), node.marks);

    case 'hardbreak':
      return '<br>';

    case 'paragraph': {
      const inner = renderNodes(kids);
      return inner.trim() ? `<p>${inner}</p>\n` : '';
    }

    case 'heading': {
      const lvl = Math.min(Math.max(Number(node.attrs?.level) || 2, 2), 4); // H1 שמור לכותרת הדף
      return `<h${lvl}>${renderNodes(kids)}</h${lvl}>\n`;
    }

    case 'bulletlist':
      return `<ul>\n${renderNodes(kids)}</ul>\n`;

    case 'orderedlist': {
      const start = Number(node.attrs?.start);
      const attr = start && start !== 1 ? ` start="${start}"` : '';
      return `<ol${attr}>\n${renderNodes(kids)}</ol>\n`;
    }

    case 'listitem':
      return `<li>${unwrapSingleParagraph(kids)}</li>\n`;

    case 'blockquote':
      return `<blockquote>\n${renderNodes(kids)}</blockquote>\n`;

    case 'codeblock':
      return `<pre><code>${escapeHtml(kids.map((k) => k.text || '').join(''))}</code></pre>\n`;

    case 'horizontalrule':
      return '<hr>\n';

    case 'image': {
      const src = imageSrc(node.attrs || {});
      if (!src) return '';
      const alt = escapeHtml(node.attrs?.alt || node.attrs?.altText || '');
      const cap = node.attrs?.caption ? `<figcaption>${escapeHtml(node.attrs.caption)}</figcaption>` : '';
      const img = `<img src="${escapeHtml(src)}" alt="${alt}" loading="lazy">`;
      return cap ? `<figure>${img}${cap}</figure>\n` : `${img}\n`;
    }

    case 'table':
      return `<table>\n${renderNodes(kids)}</table>\n`;
    case 'tablerow':
      return `<tr>${renderNodes(kids)}</tr>\n`;
    case 'tableheader':
      return `<th>${unwrapSingleParagraph(kids)}</th>`;
    case 'tablecell':
      return `<td>${unwrapSingleParagraph(kids)}</td>`;

    default:
      // צומת שלא מוכר לנו — לא מאבדים את התוכן שבתוכו
      if (kids.length) return renderNodes(kids);
      if (node.text) return escapeHtml(node.text);
      warn(`צומת מסוג "${node.type}" לא נתמך — דולג.`);
      return '';
  }
}

/** עץ התוכן -> HTML. מקבל עץ, מערך צמתים, או מחרוזת HTML מוכנה. */
function contentToHtml(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return renderNodes(content);
  return renderNode(content);
}

// ----------------------------------------------------------------------------
// בניית הדף
// ----------------------------------------------------------------------------

/** CSS נוסף לאלמנטים שהתבנית המקורית לא מכסה, בפלטת הצבעים של האתר. */
const EXTRA_CSS = `
<style id="opinly-content-css">
.content h3 { font-size:1.5rem; font-weight:800; color:#243e38; margin-top:2rem; margin-bottom:1rem; font-style:italic; }
.content ul, .content ol { margin:0 0 1.5rem 0; padding-right:1.75rem; font-size:1.15rem; line-height:1.9; color:#374151; }
.content ul { list-style:disc; }
.content ol { list-style:decimal; }
.content li { margin-bottom:.6rem; }
.content li::marker { color:#1B6B3A; }
.content a { color:#1B6B3A; font-weight:700; text-decoration:underline; text-underline-offset:3px; }
.content strong { color:#243e38; font-weight:800; }
.content blockquote { border-right:4px solid #94937f; padding:.5rem 1.25rem; margin:0 0 1.5rem 0; background:#f8f4f1; border-radius:0 8px 8px 0; color:#374151; }
.content table { width:100%; border-collapse:collapse; margin-bottom:1.5rem; font-size:1.05rem; direction:rtl; }
.content th, .content td { border:1px solid #e5e1d8; padding:.75rem 1rem; text-align:right; }
.content th { background:#f4f9f6; color:#243e38; font-weight:800; }
.content figure { margin:0 0 1.5rem 0; }
.content figure img { width:100%; border-radius:8px; }
.content figcaption { font-size:.95rem; color:#6b7280; margin-top:.5rem; }
.content bdi { unicode-bidi:isolate; }
</style>`;

/** תאריכים: אופנלי מחזיר firstPublishedAt / lastPublishedAt / modifiedAt. */
const publishedDate = (p) => (p.firstPublishedAt || p.lastPublishedAt || '').slice(0, 10);
const modifiedDate = (p) => (p.modifiedAt || p.lastPublishedAt || p.firstPublishedAt || '').slice(0, 10);

function buildJsonLd(post, url) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.metaDescription || post.description || '',
    author: { '@type': 'Person', '@id': CONFIG.author.id, name: CONFIG.author.name, url: CONFIG.author.url },
    publisher: {
      '@type': 'Organization', '@id': `${CONFIG.siteUrl}/#business`,
      name: CONFIG.publisher.name, url: CONFIG.publisher.url,
      logo: { '@type': 'ImageObject', url: CONFIG.publisher.logo },
    },
    url,
    datePublished: publishedDate(post),
    dateModified: modifiedDate(post),
    image: imageSrc(post.image ?? post.titleImage ?? post.images?.[0]) || CONFIG.publisher.logo,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'he-IL',
  };
}

function buildBreadcrumb(post, url) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'דף הבית', item: `${CONFIG.siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: CONFIG.breadcrumbParent.name, item: `${CONFIG.siteUrl}${CONFIG.breadcrumbParent.url}` },
      { '@type': 'ListItem', position: 3, name: post.title, item: url },
    ],
  };
}

function renderPage(template, post, slug) {
  const url = `${CONFIG.siteUrl}/${CONFIG.outDir}/${slug}.html`;
  const title = post.metaTitle || `${post.title} | תלם`;
  const desc = post.metaDescription || post.description || '';

  // גוף המאמר: עץ צמתים -> HTML -> איחוד מונחים -> בידוד לטיני
  let body = contentToHtml(post.content);
  body = isolateLatin(normalizeTerms(body));

  // ה-H1 מגיע מהכותרת, ולא מהתוכן — מסירים h1 כפול אם קיים
  body = body.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '');

  const h1 = isolateLatin(escapeHtml(post.title));

  let out = template;

  // --- head ---
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  out = out.replace(/<meta name="description" content="[^"]*">/i,
    `<meta name="description" content="${escapeHtml(desc)}">`);
  out = out.replace(/<link rel="canonical" href="[^"]*">/i,
    `<link rel="canonical" href="${url}">`);
  out = out.replace(/<link rel="alternate" hreflang="he-IL" href="[^"]*">/i,
    `<link rel="alternate" hreflang="he-IL" href="${url}">`);
  out = out.replace(/<link rel="alternate" hreflang="x-default" href="[^"]*">/i,
    `<link rel="alternate" hreflang="x-default" href="${url}">`);

  // --- schema (שני בלוקי ld+json ראשונים: Article ואז BreadcrumbList) ---
  let ldSeen = 0;
  out = out.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, (m) => {
    ldSeen += 1;
    if (ldSeen === 1) return `<script type="application/ld+json">\n${JSON.stringify(buildJsonLd(post, url), null, 2)}\n</script>`;
    if (ldSeen === 2) return `<script type="application/ld+json">\n${JSON.stringify(buildBreadcrumb(post, url), null, 2)}\n</script>`;
    return m;
  });

  // --- CSS נוסף לפני </head> ---
  out = out.replace(/<\/head>/i, `${EXTRA_CSS}\n</head>`);

  // --- פירורי לחם (הפריט האחרון) ---
  out = out.replace(
    /(<nav class="mb-8 text-telem-moss[^"]*">[\s\S]*?<span class="text-telem-dark underline decoration-telem-khaki">)[\s\S]*?(<\/span><\/nav>)/i,
    `$1${escapeHtml(post.title)}$2`
  );

  // --- H1 ---
  out = out.replace(/(<h1 class="text-4xl[^"]*">)[\s\S]*?(<\/h1>)/i, `$1${h1}$2`);

  // --- גוף המאמר ---
  out = out.replace(/(<div class="content">)[\s\S]*?(<\/div><div class="author-note")/i,
    `$1\n${body}\n$2`);

  return out;
}

// ----------------------------------------------------------------------------
// sitemap
// ----------------------------------------------------------------------------

async function updateSitemap(urls) {
  const file = 'sitemap.xml';
  let xml;
  try { xml = await fs.readFile(file, 'utf8'); }
  catch { warn('אין sitemap.xml — מדלג'); return; }

  let added = 0;
  for (const { loc, lastmod } of urls) {
    if (xml.includes(`<loc>${loc}</loc>`)) continue;
    const entry = `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>\n`;
    xml = xml.replace(/<\/urlset>/i, `${entry}</urlset>`);
    added += 1;
  }

  if (added && !DRY_RUN) await fs.writeFile(file, xml, 'utf8');
  log(`sitemap: נוספו ${added} כתובות`);
}

// ----------------------------------------------------------------------------
// main
// ----------------------------------------------------------------------------

async function main() {
  const apiKey = process.env.OPINLY_API_KEY;
  if (!apiKey) throw new Error('חסר OPINLY_API_KEY. הוסף אותו ל-GitHub Secrets.');
  if (!apiKey.startsWith('sk-')) warn('המפתח לא מתחיל ב-sk-. ודא שזה מפתח סודי ולא מפתח פיקסל.');

  const template = await fs.readFile(CONFIG.templateFile, 'utf8');

  let manifest = {};
  try { manifest = JSON.parse(await fs.readFile(CONFIG.manifestFile, 'utf8')); } catch { /* ריק בפעם הראשונה */ }

  const cards = await fetchPublishedPosts(apiKey);
  log(`התקבלו ${cards.length} פוסטים שפורסמו`);

  const written = [];
  const created = [];
  const skipped = [];

  for (const card of cards) {
    const slug = safeSlug(card.slug, card.title);
    if (!slug) {
      skipped.push({ title: card.title || card.slug || '(ללא כותרת)', reason: 'slug פגום' });
      continue;
    }

    const file = path.join(CONFIG.outDir, `${slug}.html`);
    const isOurs = Object.prototype.hasOwnProperty.call(manifest, slug);

    // הגנה: לא דורסים דף שנכתב ביד
    let current = null;
    try { current = await fs.readFile(file, 'utf8'); } catch { /* לא קיים */ }
    const exists = current !== null;
    if (exists && !isOurs && !FORCE) {
      warn(`${file} קיים ואינו מנוהל על ידי הסקריפט — מדלג. (--force כדי לדרוס)`);
      skipped.push({ title: card.title || slug, reason: `התנגשות עם דף קיים (${file})` });
      continue;
    }

    // גוף המאמר מגיע רק מהקריאה הבודדת
    let post;
    try {
      post = { ...card, ...(await fetchFullPost(apiKey, card.slug)) };
    } catch (err) {
      warn(`שליפת "${card.title}" נכשלה — ${err.message}`);
      skipped.push({ title: card.title || slug, reason: `שליפת התוכן נכשלה (${err.message})` });
      continue;
    }

    let html;
    try {
      html = renderPage(template, post, slug);
    } catch (err) {
      warn(`בניית הדף של "${post.title}" נכשלה — ${err.message}`);
      skipped.push({ title: post.title || slug, reason: `בניית הדף נכשלה (${err.message})` });
      continue;
    }

    // בדיקת שפיות: דף בלי גוף מאמר לא נשמר
    const bodyLen = (html.match(/<div class="content">([\s\S]*?)<\/div><div class="author-note"/i)?.[1] || '')
      .replace(/<[^>]+>/g, '').trim().length;
    if (bodyLen < 200) {
      warn(`"${post.title}" — גוף המאמר ריק או קצר מדי (${bodyLen} תווים). מדלג.`);
      skipped.push({ title: post.title || slug, reason: `גוף המאמר ריק או קצר מדי (${bodyLen} תווים)` });
      continue;
    }

    const url = `${CONFIG.siteUrl}/${CONFIG.outDir}/${slug}.html`;
    written.push({
      loc: url,
      lastmod: modifiedDate(post) || new Date().toISOString().slice(0, 10),
    });

    // אין שינוי בתוכן — לא נוגעים בקובץ, לא מדווחים, ולא יוצרים commit ריק
    if (current === html) {
      log(`= ${file} — ללא שינוי`);
      continue;
    }

    if (!DRY_RUN) await fs.writeFile(file, html, 'utf8');

    manifest[slug] = {
      slug,
      title: post.title,
      syncedAt: new Date().toISOString(),
    };
    created.push({ title: post.title || slug, url });
    log(`✓ ${file} (${bodyLen} תווים)${exists ? ' — עודכן' : ''}`);
  }

  if (!DRY_RUN) {
    await fs.writeFile(CONFIG.manifestFile, JSON.stringify(manifest, null, 2), 'utf8');
  }
  await updateSitemap(written);

  // סיכום לריצה ב-CI. בהרצה יבשה לא כותבים כלום.
  if (!DRY_RUN) {
    const summary = { runAt: new Date().toISOString(), created, skipped };
    await fs.writeFile(SUMMARY_FILE, JSON.stringify(summary, null, 2), 'utf8');
    log(`סיכום נכתב ל-${SUMMARY_FILE} — ${created.length} נוצרו, ${skipped.length} דולגו`);
  }

  log(DRY_RUN ? `סיום (הרצה יבשה) — ${written.length} דפים היו נכתבים` : `סיום — ${written.length} דפים`);
}

main().catch((err) => { console.error('[opinly] ✗', err.message); process.exit(1); });
