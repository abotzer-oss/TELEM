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
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';

// ----------------------------------------------------------------------------
// הגדרות
// ----------------------------------------------------------------------------

const CONFIG = {
  apiBase: 'https://sdk.opinly.ai/v1',
  siteUrl: 'https://telemenv.co.il',
  outDir: 'guides',                        // הפוסטים נוחתים כאן
  templateFile: 'guides/price.html',       // הדף שממנו נלקחת השפה העיצובית
  manifestFile: 'guides/.opinly-manifest.json',
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

  return html
    .split(PROTECT)
    .map((chunk, i) => {
      if (i % 2 === 1) return chunk;              // תגית — לא נוגעים
      if (!/[\u0590-\u05FF]/.test(chunk)) return chunk; // אין עברית — אין בעיית כיווניות
      return chunk.replace(LATIN, '<bdi>$1</bdi>');
    })
    .join('');
}

/** מנקה ומאחד מונחי Phase לצורה אחת (ספרות רומיות). */
function normalizeTerms(md) {
  return md
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

async function fetchPublishedPosts(apiKey) {
  const posts = [];
  let cursor = null;

  do {
    const url = new URL(`${CONFIG.apiBase}/content/posts`);
    url.searchParams.set('limit', '50');
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Opinly API ${res.status} ${res.statusText} — ${await res.text()}`);
    }

    const data = await res.json();
    const batch = data.posts ?? data.data ?? data.items ?? [];
    posts.push(...batch);
    cursor = data.next_cursor ?? data.nextCursor ?? null;
  } while (cursor);

  return posts;
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
.content bdi { unicode-bidi:isolate; }
</style>`;

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
    datePublished: (post.publishedAt || '').slice(0, 10),
    dateModified: (post.updatedAt || post.publishedAt || '').slice(0, 10),
    image: post.titleImageUrl || CONFIG.publisher.logo,
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

  // גוף המאמר: מארקדאון -> HTML -> איחוד מונחים -> בידוד לטיני
  let body = marked.parse(normalizeTerms(post.content || ''), { mangle: false, headerIds: false });
  body = isolateLatin(body);

  // ה-H1 מגיע מהכותרת, ולא מהמארקדאון — מסירים h1 כפול אם קיים
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

  const posts = await fetchPublishedPosts(apiKey);
  log(`התקבלו ${posts.length} פוסטים שפורסמו`);

  const written = [];

  for (const post of posts) {
    // רשת ביטחון: ה-API אמור להחזיר רק פוסטים שפורסמו, אבל אין להסתמך על כך.
    if (post.status !== 'published') {
      warn(`מדלג על "${post.title}" — סטטוס ${post.status || 'לא ידוע'} ואינו published`);
      continue;
    }

    const slug = safeSlug(post.slug, post.title);
    if (!slug) continue;

    const file = path.join(CONFIG.outDir, `${slug}.html`);
    const isOurs = Object.prototype.hasOwnProperty.call(manifest, slug);

    // הגנה: לא דורסים דף שנכתב ביד
    let exists = true;
    try { await fs.access(file); } catch { exists = false; }
    if (exists && !isOurs && !FORCE) {
      warn(`${file} קיים ואינו מנוהל על ידי הסקריפט — מדלג. (--force כדי לדרוס)`);
      continue;
    }

    const html = renderPage(template, post, slug);
    if (!DRY_RUN) await fs.writeFile(file, html, 'utf8');

    manifest[slug] = {
      postId: post.id,
      title: post.title,
      syncedAt: new Date().toISOString(),
    };
    written.push({
      loc: `${CONFIG.siteUrl}/${CONFIG.outDir}/${slug}.html`,
      lastmod: (post.updatedAt || post.publishedAt || new Date().toISOString()).slice(0, 10),
    });
    log(`✓ ${file}`);
  }

  if (!DRY_RUN) {
    await fs.writeFile(CONFIG.manifestFile, JSON.stringify(manifest, null, 2), 'utf8');
  }
  await updateSitemap(written);

  log(DRY_RUN ? `סיום (הרצה יבשה) — ${written.length} דפים היו נכתבים` : `סיום — ${written.length} דפים`);
}

main().catch((err) => { console.error('[opinly] ✗', err.message); process.exit(1); });
