#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_ledger.py — הפנקס הקבוע של בדיקות SEO/GEO לאתר telemenv.co.il

מריץ את כל הבדיקות שניתן למדוד אוטומטית מקוד המקור, וכותב:
  audit-ledger.csv   page,check_id,status,date,by,note,next_due
  audit/ledger-raw.json  (נתוני גלם לכל עמוד)

מזהי הבדיקות לפי references/audit-checklist.md שבסקיל geo-seo-hebrew.
שים לב: הצ'ק-ליסט מכיל 11 פריטים בסעיף B ו-5 בסעיף F (לא 12 ו-6).

status:
  pass    — נמדד ועבר
  fail    — נמדד ונכשל
  unknown — לא ניתן למדידה מהקוד (דורש GSC/GA4/לוגים/שיפוט אנושי)

שימוש:
  python tools/build_ledger.py            # בדיקות סטטיות בלבד (מהיר, ללא רשת)
  python tools/build_ledger.py --live     # כולל בדיקות HTTP חיות
"""

import argparse
import csv
import datetime as dt
import json
import os
import re
import subprocess
import sys
# הקונסולה של Windows ברירת‑מחדל cp1252 ולא יודעת לכתוב עברית
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):
        pass

from collections import Counter

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://telemenv.co.il"
TODAY = dt.date.today()
PHONE = "050-6890650"

NIQQUD = re.compile(r"[֑-ׇ]")
HEB = re.compile(r"[֐-׿]")
LATIN_RUN_IN_HEB = re.compile(
    r"[֐-׿][^\S\n]*([A-Za-z][A-Za-z0-9.\-/%()']*)[^\S\n]*[֐-׿]")

# ידוע כמנוע-WAF: חוסם בוטים אך תקין בדפדפן. לא נספר ככשל.
WAF_HOSTS = {"www.gov.il", "www.iso.org", "www.nta.co.il", "www.jerusalem.muni.il",
             "www.netanya.muni.il", "www.linkedin.com", "main.knesset.gov.il",
             "www.nevo.co.il", "www.mako.co.il"}
# דומיינים שאינם מתקיימים כלל (nslookup NXDOMAIN, אומת 2026-08-04)
DEAD_HOSTS = {"www.geologists.org.il", "geologists.org.il",
              "www.netivei-israel.co.il", "netivei-israel.co.il",
              "www.shama.co.il", "shama.co.il", "www.icea.co.il", "icea.co.il"}

CHECKS = {
    # A — חסמים
    "A1": "HTML גולמי (ללא JS) מכיל את התוכן בפועל",
    "A2": "robots.txt אינו חוסם זחלני חיפוש או AI",
    "A3": "אין noindex תועה בעמודים חיים; קיים בעמודי /lp/",
    "A4": "canonical מוחלט, מצביע על עצמו, תואם לכתובת המוגשת",
    "A5": "האתר מחזיר 200 לגרסה הקנונית; hostname יחיד עם 301",
    "A6": "HTTPS תקין, ללא mixed content",
    "A7": "sitemap.xml קיים, עדכני, מוצהר ב-robots.txt, רק URLs אינדקסביליים",
    "A8": "אין עמודים כפולים המתחרים על אותה שאילתה",
    # B — עמוד
    "B1": "title ייחודי, מילת המפתח מקדימה, מותג בסוף, נכנס בחיתוך",
    "B2": "meta description ייחודי עם הבטחה קונקרטית",
    "B3": "בדיוק h1 אחד",
    "B4": "היררכיית h2/h3 תקינה, ללא דילוגי רמה, כותרות כשאלות",
    "B5": "התשובה המרכזית במסך הראשון",
    "B6": "תוכן ייחודי ומהותי",
    "B7": "תמונות: alt תיאורי, width/height, lazy מתחת לקיפול",
    "B8": "קישורים פנימיים נכנסים/יוצאים עם עוגן תיאורי",
    "B9": "structured data קיים ותקין לסוג העמוד",
    "B10": "מחבר גלוי ותאריך עדכון בתוכן עריכתי",
    "B11": "קריאה לפעולה ברורה (טלפון/וואטסאפ/טופס)",
    # C — עברית / RTL
    "C1": '<html lang="he" dir="rtl">',
    "C2": "רצפי לטינית ומספרים בתוך עברית מבודדים ב-bdi",
    "C3": "title ו-description נקראים נכון ב-RTL",
    "C4": "אין ניקוד בכותרת, כותרות, meta או slug",
    "C5": "מוסכמת slug אחידה באתר",
    "C6": "כיסוי וריאנטים של מילות מפתch (תחיליות, רבים, כתיב מלא/חסר)",
    "C7": "צמדי מונח עברי-אנגלי מוגדרים פעם אחת",
    "C8": 'טבלאות ורשימות עם dir="rtl"',
    "C9": "hreflang הדדי עם x-default (אם קיימת שפה שנייה)",
    "C10": 'סכמה עם inLanguage he-IL וערכי UTF-8 תקינים',
    # D — GEO
    "D1": "זחלני AI מותרים במפורש",
    "D2": "llms.txt קיים ועדכני",
    "D3": "כל מקטע עומד במבחן החילוץ של 40 מילים",
    "D4": "פרטים קונקרטיים: מספרים, תאריכים, תקנים, ספים",
    "D5": "מקטע שאלות נפוצות גלוי ומסומן בסכמה",
    "D6": "טבלאות השוואה / תהליכים ממוספרים היכן שמתאים",
    "D7": "עקביות ישות: שם, כתובת, טלפון, אנשים",
    "D8": "מחבר בעל שם והסמכה; עמוד אודות מגדיר את הארגון",
    "D9": "ציטוט מקורות ראשוניים/סמכותיים",
    "D10": "אזכורים חיצוניים מאששים (מדריכים, איגודים, עיתונות)",
    # E — טכני
    "E1": "Core Web Vitals: LCP, CLS, INP",
    "E2": "רינדור מובייל ו-tap targets",
    "E3": "ללא חסימת רינדור; פונטים עבריים בסאבסט",
    "E4": "404 וקישורים שבורים, פנימיים וחיצוניים",
    "E5": "עדות ללוגים/אנליטיקס של פעילות זחלנים",
    # F — מחוץ לאתר
    "F1": "Google Business Profile מלא ובקטגוריה נכונה",
    "F2": "פרופיל קישורים נכנסים רלוונטי ונקי",
    "F3": "המותג מוזכר באתרים שמדורגים לשאילתות הקטגוריה",
    "F4": "GSC ו-GA4 מחוברים, ערוץ AI מוגדר, המרות נמדדות",
    "F5": "סט פרומפטים קבוע לבדיקת נראות ב-AI מדי חודש",
}

SITE_CHECKS = {"A2", "A5", "A7", "A8", "C5", "C9", "D1", "D2", "D10",
               "E1", "E4", "E5", "F1", "F2", "F3", "F4", "F5"}


def sh(*args):
    return subprocess.run(args, capture_output=True, text=True, cwd=REPO).stdout


def page_url(rel):
    if rel == "index.html":
        return BASE + "/"
    if rel.endswith("/index.html"):
        return BASE + "/" + rel[:-len("index.html")]
    return BASE + "/" + rel


def strip_scripts(html):
    return re.sub(r"<script.*?</script>", " ", html, flags=re.S | re.I)


def visible_text(html):
    t = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def load_pages():
    files = [f for f in sh("git", "ls-files", "*.html").split()
             if not f.startswith("seo-audit/")]
    pages = {}
    for rel in files:
        path = os.path.join(REPO, rel.replace("/", os.sep))
        html = open(path, encoding="utf-8", errors="replace").read()
        pages[rel] = analyse(rel, html)
    return pages


# עמודי שירות שאינם עמודי תוכן: הפניה 301-רכה, עמוד תודה ועמוד 404.
# בדיקות תוכן, סכמה ו-canonical לא חלות עליהם.
UTILITY = {"history/index.html", "lp/toda/index.html", "404.html"}


def analyse(rel, html):
    d = {"file": rel, "url": page_url(rel), "is_lp": rel.startswith("lp/"),
         "utility": rel in UTILITY}
    nos = strip_scripts(html)
    txt = visible_text(html)
    d["text"] = txt
    d["words"] = len(txt.split())

    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.S | re.I)
    d["title"] = re.sub(r"\s+", " ", m.group(1)).strip() if m else ""
    m = re.search(r'<meta[^>]+name="description"[^>]+content="([^"]*)"', html, re.I)
    d["desc"] = m.group(1).strip() if m else ""
    m = re.search(r'<link[^>]+rel="canonical"[^>]+href="([^"]*)"', html, re.I)
    d["canonical"] = m.group(1) if m else ""
    m = re.search(r'<meta[^>]+name="robots"[^>]+content="([^"]*)"', html, re.I)
    d["robots"] = (m.group(1) if m else "").lower()
    m = re.search(r"<html([^>]*)>", html, re.I)
    ha = m.group(1) if m else ""
    d["lang"] = (re.search(r'lang="([^"]*)"', ha) or [None, ""])[1] if 'lang=' in ha else ""
    d["dir"] = (re.search(r'dir="([^"]*)"', ha) or [None, ""])[1] if 'dir=' in ha else ""
    d["viewport"] = bool(re.search(r'name="viewport"', html, re.I))

    d["headings"] = [(int(l), re.sub(r"\s+", " ", visible_text(t)).strip())
                     for l, t in re.findall(r"<h([1-6])[^>]*>(.*?)</h\1>", html, re.S | re.I)]
    d["h1"] = [t for l, t in d["headings"] if l == 1]
    d["q_headings"] = sum(1 for _, t in d["headings"] if "?" in t)
    lv = [l for l, _ in d["headings"]]
    d["level_skip"] = any(b - a > 1 for a, b in zip(lv, lv[1:]))

    # first substantive paragraph after the h1
    m = re.search(r"</h1>(.*?)(?:<h2|\Z)", html, re.S | re.I)
    first = visible_text(m.group(1))[:600] if m else ""
    d["first_para_len"] = len(first)

    # JSON-LD
    d["schema_types"], d["schema_errors"], d["schema_blobs"] = [], [], []
    for blob in re.findall(r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>',
                           html, re.S | re.I):
        blob = blob.strip()
        if not blob:
            continue
        d["schema_blobs"].append(blob)
        try:
            data = json.loads(blob)
        except Exception as e:
            d["schema_errors"].append(str(e)[:120])
            continue

        def walk(n):
            if isinstance(n, dict):
                t = n.get("@type")
                d["schema_types"].extend(t if isinstance(t, list) else [t] if t else [])
                for v in n.values():
                    walk(v)
            elif isinstance(n, list):
                for v in n:
                    walk(v)
        walk(data)
    d["schema_types"] = sorted(set(d["schema_types"]))
    d["inLanguage_he"] = bool(re.search(r'"inLanguage"\s*:\s*"he-IL"', html))
    d["dateModified"] = re.findall(r'"dateModified"\s*:\s*"([^"]*)"', html)
    d["datePublished"] = re.findall(r'"datePublished"\s*:\s*"([^"]*)"', html)
    d["mojibake"] = bool(re.search(r"[ÃÂ×][-¿]", html))

    # links
    d["anchors"] = [(h, re.sub(r"\s+", " ", visible_text(t)).strip())
                    for h, t in re.findall(r'<a\b[^>]*\bhref="([^"]*)"[^>]*>(.*?)</a>', html, re.S | re.I)]
    p = d["url"][len(BASE):]
    selfset = {p, d["url"], p.rstrip("/") or "/", d["url"].rstrip("/")}
    if p.endswith("/"):
        selfset |= {p + "index.html", d["url"] + "index.html"}
    # קישור עצמי בלי טקסט עוגן (לוגו בכותרת) אינו מעביר אות ואינו נחשב לתקלה
    d["self_links"] = [h for h, t in d["anchors"]
                       if h in selfset and re.sub(r"<[^>]+>", "", t).strip()]
    d["internal_links"] = [h for h, _ in d["anchors"]
                           if h.startswith("/") or h.startswith(BASE)]
    d["external_hosts"] = [re.match(r"https?://([^/]+)", h).group(1)
                           for h, _ in d["anchors"] if re.match(r"https?://", h)
                           and "telemenv" not in h]
    d["dead_links"] = sorted({h for h, _ in d["anchors"]
                              if re.match(r"https?://", h)
                              and re.match(r"https?://([^/]+)", h).group(1) in DEAD_HOSTS})
    d["weak_anchors"] = [t for _, t in d["anchors"]
                         if re.fullmatch(r"\s*(לחצו כאן|לחץ כאן|קרא עוד|קראו עוד|כאן|למידע נוסף|עוד)\s*[«»←→]?\s*", t)]
    d["cta"] = bool(re.search(r'href="tel:|href="https://wa\.me/', html))
    d["http_assets"] = re.findall(r'(?:src|href)="(http://[^"]+)"', html)

    # images
    imgs = re.findall(r"<img\b[^>]*>", html)
    d["imgs"] = len(imgs)
    d["imgs_no_alt"] = sum(1 for i in imgs if not re.search(r'alt="[^"]+"', i))
    d["imgs_no_dim"] = sum(1 for i in imgs if not (re.search(r"\bwidth=", i) and re.search(r"\bheight=", i)))
    d["imgs_no_lazy"] = sum(1 for i in imgs if "loading=" not in i)

    # Hebrew / RTL
    d["latin_runs"] = LATIN_RUN_IN_HEB.findall(txt)
    d["bdi"] = len(re.findall(r"<bdi\b", html))
    d["niqqud_meta"] = bool(NIQQUD.search(d["title"] + d["desc"]) or
                            any(NIQQUD.search(t) for _, t in d["headings"]))
    d["title_latin"] = bool(re.search(r"[A-Za-z]", d["title"]))
    d["tables"] = len(re.findall(r"<table\b", html))
    d["tables_rtl"] = len(re.findall(r'<table\b[^>]*dir="rtl"', html))
    d["lists"] = len(re.findall(r"<(ul|ol)\b", html))
    d["ordered_lists"] = len(re.findall(r"<ol\b", html))
    # term pairs like  סקר היסטורי (Phase I)
    d["term_pairs"] = len(re.findall(r"[֐-׿]\s*\(\s*[A-Za-z][^)]{1,40}\)", txt))

    # GEO substance — עוגני עובדה שמודל יכול לצטט
    d["numeric_facts"] = len(re.findall(r"(?<![\w/])\d[\d,.]*(?![\w/])", txt)) \
        + len(re.findall(r"תק(?:ן|נות|נה)\b|חוק\s|תמ\"א|תמ״א|ת\"י|ת״י|סעיף\s|תקנה\s", txt))
    d["visible_faq"] = bool(re.search(r"שאלות נפוצות|שאלות ותשובות", nos))
    d["has_faqpage"] = "FAQPage" in d["schema_types"]
    d["visible_date"] = bool(re.search(r"עודכן|עדכון אחרון|פורסם ב", nos))
    d["author_note"] = "אבירם בוצר" in nos
    d["authority_links"] = sum(1 for h in d["external_hosts"]
                               if h.endswith(("gov.il", "org.il")) or "iplan" in h)
    d["phone_ok"] = PHONE in nos or "0506890650" in html

    # empty heading blocks (h2 + only h3 children, no paragraph text)
    d["empty_heading_blocks"] = []
    for sec in re.findall(r"<section\b[^>]*>.*?</section>", html, re.S | re.I):
        body = re.sub(r"<h[1-6][^>]*>.*?</h[1-6]>", " ", sec, flags=re.S | re.I)
        if re.search(r"<h2\b", sec, re.I) and re.search(r"<h3\b", sec, re.I) \
                and len(visible_text(body)) < 20:
            d["empty_heading_blocks"].append(visible_text(sec)[:80])

    # content stranded after </footer>
    i = html.rfind("</footer>")
    tail = html[i + 9:] if i != -1 else ""
    tail_nochrome = re.sub(r'<div id="mobile-cta-banner".*?</div>\s*</div>', " ", tail, flags=re.S)
    tail_nochrome = re.sub(r'<div id="(mobile-cta-banner|cookie-banner|telem-cookie)[^"]*".*?\Z',
                           " ", tail_nochrome, flags=re.S)
    d["words_after_footer"] = len(visible_text(strip_scripts(tail_nochrome)).split())

    # duplicated official-link blocks
    d["link_block_headings"] = [visible_text(h) for h in
                                re.findall(r"<h[23][^>]*>(.*?)</h[23]>", html, re.S | re.I)
                                if re.search(r"קישורים|מקורות", visible_text(h))]

    # fonts / render blocking
    d["gfont_display_swap"] = ("fonts.googleapis" not in html) or ("display=swap" in html)
    d["blocking_head_scripts"] = len([s for s in re.findall(r"<script\b[^>]*>", html[:html.find("</head>") if "</head>" in html else 0])
                                      if "async" not in s and "defer" not in s
                                      and "application/ld+json" not in s and "src=" in s])
    return d


# ------------------------------------------------------------------ checks
def evaluate(pages, live=None):
    rows = []
    titles = Counter(p["title"] for p in pages.values() if not p["is_lp"])
    descs = Counter(p["desc"] for p in pages.values() if not p["is_lp"])

    def add(page, cid, status, note=""):
        if status == "pass":
            due = TODAY + dt.timedelta(days=90)
        elif status == "fail":
            due = TODAY + dt.timedelta(days=7)
        else:
            due = TODAY + dt.timedelta(days=30)
        rows.append([page, cid, status, TODAY.isoformat(), "code", note, due.isoformat()])

    # ---------------- site level
    robots = ""
    rp = os.path.join(REPO, "robots.txt")
    if os.path.exists(rp):
        robots = open(rp, encoding="utf-8").read()
    need_bots = ["Bingbot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot",
                 "ClaudeBot", "Claude-SearchBot", "Google-Extended", "Googlebot"]
    missing = [b for b in need_bots if not re.search(rf"^User-agent:\s*{re.escape(b)}\s*$",
                                                     robots, re.M | re.I)]
    disallow_all = re.search(r"^User-agent:\s*\*\s*$\s*Disallow:\s*/\s*$", robots, re.M | re.I)
    add("(site)", "A2", "fail" if disallow_all else "pass",
        "אין חסימה גורפת" if not disallow_all else "Disallow: / לכולם")
    add("(site)", "D1", "pass" if not missing else "fail",
        "כל הזחלנים מוצהרים במפורש" if not missing else "חסרות קבוצות מפורשות: " + ", ".join(missing))

    sm = os.path.join(REPO, "sitemap.xml")
    sitemap_urls = set()
    if os.path.exists(sm):
        sitemap_urls = set(re.findall(r"<loc>\s*([^<\s]+)\s*</loc>",
                                      open(sm, encoding="utf-8").read()))
    indexable = {p["url"] for p in pages.values()
                 if not p["is_lp"] and "noindex" not in p["robots"]
                 and p["canonical"].rstrip("/") == p["url"].rstrip("/")}
    miss = sorted(indexable - sitemap_urls)
    extra = sorted(sitemap_urls - indexable)
    # lastmod אמיתי = תואם לתאריך הקומיט האחרון של הקובץ. אחידות כשלעצמה אינה
    # ראיה לזיוף — עריכה רוחבית באמת נוגעת בכל הקבצים באותו יום.
    pairs = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>\s*<lastmod>([^<]+)</lastmod>",
                       open(sm, encoding="utf-8").read()) if os.path.exists(sm) else []
    url2file = {p["url"]: p["file"] for p in pages.values()}
    wrong = []
    for loc, mod in pairs:
        rel = url2file.get(loc)
        if not rel:
            continue
        real = sh("git", "log", "-1", "--format=%cs", "--", rel).strip()
        if real and mod.strip() != real:
            wrong.append(f"{loc.replace(BASE, '')} ({mod}≠{real})")
    note = []
    if miss:
        note.append("חסרים: " + ", ".join(u.replace(BASE, "") for u in miss))
    if extra:
        note.append("עודפים: " + ", ".join(u.replace(BASE, "") for u in extra))
    if wrong:
        note.append(f"lastmod לא תואם לקומיט ב-{len(wrong)} כתובות: " + "; ".join(wrong[:3]))
    if "Sitemap:" not in robots:
        note.append("לא מוצהר ב-robots.txt")
    add("(site)", "A7", "fail" if note else "pass", "; ".join(note) or
        f"{len(sitemap_urls)} כתובות, כולן אינדקסביליות, lastmod פר-קובץ")

    lt = os.path.join(REPO, "llms.txt")
    if not os.path.exists(lt):
        add("(site)", "D2", "fail", "הקובץ לא קיים")
    else:
        c = open(lt, encoding="utf-8").read()
        urls_in = set(re.findall(r"\((https://telemenv\.co\.il[^)]*)\)", c))
        known = {p["url"] for p in pages.values()} | {BASE + "/"}
        bad = sorted(u for u in urls_in if u.rstrip("/") + "/" not in {k.rstrip("/") + "/" for k in known})
        # הקובץ עטוף בשורות — משווים על טקסט מנורמל, לא על התו הגולמי
        flat = re.sub(r"[\s>]+", " ", c)
        pos = "מבצע סקרי קרקע היסטוריים (Phase I), כותב תוכניות דיגום" in flat
        n = []
        if bad:
            n.append("קישורים שלא קיימים באתר: " + ", ".join(u.replace(BASE, "") for u in bad))
        if not pos:
            n.append("חסר משפט הפוזיציה המדויק")
        if len(c.splitlines()) > 80:
            n.append(f"ארוך מדי ({len(c.splitlines())} שורות; מומלץ עד ~50)")
        add("(site)", "D2", "fail" if n else "pass", "; ".join(n) or "עדכני, קישורים תקינים")

    slugs = [p["file"] for p in pages.values()]
    add("(site)", "C5", "pass" if not any(HEB.search(s) for s in slugs) else "fail",
        "כל ה-slugs בלטינית מתועתקת, מקפים בלבד")
    add("(site)", "C9", "pass", "אתר חד-לשוני (he-IL בלבד) — hreflang אינו נדרש")

    if live:
        add("(site)", "A5", "pass" if live["https_enforced"] and live["www_301"] else "fail",
            live["a5_note"])
        add("(site)", "E4", "pass" if live["e4_ok"] else "fail", live["e4_note"])
    else:
        add("(site)", "A5", "unknown", "דורש --live")
        add("(site)", "E4", "unknown", "דורש --live")

    add("(site)", "A8", "unknown",
        "זיהוי קניבליזציה דורש נתוני שאילתות מ-Search Console")
    add("(site)", "D10", "unknown",
        "אזכורים חיצוניים דורשים בדיקת backlinks/מדריכים ידנית")
    add("(site)", "E1", "unknown", "CWV דורש CrUX/PageSpeed — לא נמדד מהקוד")
    add("(site)", "E5", "unknown", "אין גישה ללוגי שרת; GitHub Pages אינו חושף אותם")
    for cid, why in [("F1", "Google Business Profile"), ("F2", "פרופיל קישורים נכנסים"),
                     ("F3", "אזכורי מותג בתוצאות הקטגוריה"),
                     ("F4", "חיבור GSC/GA4 והגדרת ערוץ AI"),
                     ("F5", "סט פרומפטים לבדיקת נראות ב-AI")]:
        add("(site)", cid, "unknown", why + " — מחוץ ל-repo, דורש גישת בעלים")

    # ---------------- page level
    for rel, p in sorted(pages.items()):
        pg = rel

        if p["utility"]:
            kind = {"history/index.html": "עמוד הפניה",
                    "lp/toda/index.html": "עמוד תודה",
                    "404.html": "עמוד 404"}[rel]
            for cid in ("A1", "B4", "B5", "B6", "B7", "B8", "B9", "B10", "B11",
                        "C2", "C7", "C8", "D3", "D4", "D5", "D6", "D7", "D8", "D9"):
                add(pg, cid, "pass", f"{kind} — בדיקת תוכן אינה חלה")
            add(pg, "A3", "fail" if ("noindex" in p["robots"]) != p["is_lp"] else "pass",
                f'robots="{p["robots"] or "-"}"')
            add(pg, "A4", "pass" if p["canonical"] or p["is_lp"] or rel == "404.html"
                else "fail",
                p["canonical"] or f"{kind} — canonical לא נדרש")
            add(pg, "A6", "pass" if not p["http_assets"] else "fail", "אין נכסים ב-http")
            add(pg, "B1", "pass" if p["title"] else "fail", f'"{p["title"]}"')
            add(pg, "B2", "pass" if (p["desc"] or p["is_lp"]) else "fail",
                f"{len(p['desc'])} תווים" if p["desc"]
                else f"{kind} noindex — description אינו נדרש")
            add(pg, "B3", "pass" if len(p["h1"]) == 1 else "fail", f"{len(p['h1'])} h1")
            add(pg, "C1", "pass" if p["lang"].startswith("he") and p["dir"] == "rtl" else "fail",
                f'lang="{p["lang"]}" dir="{p["dir"]}"')
            add(pg, "C3", "pass" if not p["title_latin"] else "unknown", "-")
            add(pg, "C4", "pass" if not p["niqqud_meta"] else "fail", "אין ניקוד")
            add(pg, "C6", "unknown", "לא רלוונטי לעמוד שירות")
            add(pg, "C10", "pass", f"{kind} — סכמה לא נדרשת")
            add(pg, "E2", "pass" if p["viewport"] else "fail", "meta viewport")
            add(pg, "E3", "pass" if p["blocking_head_scripts"] == 0 else "fail",
                f"סקריפטים חוסמים ב-head: {p['blocking_head_scripts']}")
            continue

        add(pg, "A1", "pass" if p["words"] >= 300 else "fail",
            f"{p['words']} מילים ב-HTML גולמי")

        if p["is_lp"]:
            add(pg, "A3", "pass" if "noindex" in p["robots"] else "fail",
                f'robots="{p["robots"]}"')
        else:
            add(pg, "A3", "fail" if "noindex" in p["robots"] else "pass",
                "אין noindex" if "noindex" not in p["robots"] else "noindex בעמוד חי!")

        if p["is_lp"]:
            add(pg, "A4", "pass" if not p["canonical"] else "pass",
                "עמוד נחיתה noindex — canonical לא נדרש")
        elif not p["canonical"]:
            add(pg, "A4", "fail", "אין canonical")
        elif p["canonical"] == p["url"]:
            add(pg, "A4", "pass", p["canonical"])
        else:
            st = "pass" if rel == "history/index.html" else "fail"
            add(pg, "A4", st, f"canonical מצביע ל-{p['canonical']}" +
                (" (עמוד הפניה מכוון)" if st == "pass" else ""))

        add(pg, "A6", "pass" if not p["http_assets"] else "fail",
            "אין נכסים ב-http" if not p["http_assets"] else
            f"{len(p['http_assets'])} נכסים ב-http: {p['http_assets'][:2]}")

        if not p["title"]:
            add(pg, "B1", "fail", "אין title")
        elif titles[p["title"]] > 1:
            add(pg, "B1", "fail", "title כפול באתר")
        else:
            add(pg, "B1", "pass", f'"{p["title"]}"')

        if not p["desc"]:
            add(pg, "B2", "fail", "אין meta description")
        elif descs[p["desc"]] > 1:
            add(pg, "B2", "fail", "description כפול באתר")
        else:
            add(pg, "B2", "pass", f"{len(p['desc'])} תווים")

        add(pg, "B3", "pass" if len(p["h1"]) == 1 else "fail", f"{len(p['h1'])} h1")

        n = []
        if p["level_skip"]:
            n.append("דילוג רמת כותרת")
        if p["empty_heading_blocks"]:
            n.append(f"{len(p['empty_heading_blocks'])} בלוק כותרות ריק")
        if p["q_headings"] == 0 and len(p["headings"]) > 3:
            n.append("אין כותרות מנוסחות כשאלה")
        add(pg, "B4", "fail" if n else "pass", "; ".join(n) or
            f"{len(p['headings'])} כותרות, {p['q_headings']} כשאלה")

        add(pg, "B5", "pass" if p["first_para_len"] >= 150 else "fail",
            f"פסקה ראשונה אחרי h1: {p['first_para_len']} תווים "
            f"(פרוקסי; מיקום ויזואלי לא נמדד)")

        add(pg, "B6", "pass" if p["words"] >= 400 else "fail", f"{p['words']} מילים")

        if p["imgs"] == 0:
            add(pg, "B7", "pass", "אין תמונות בעמוד")
        else:
            n = []
            if p["imgs_no_alt"]:
                n.append(f"{p['imgs_no_alt']} ללא alt")
            if p["imgs_no_dim"]:
                n.append(f"{p['imgs_no_dim']} ללא width/height")
            if p["imgs_no_lazy"] > 1:
                n.append(f"{p['imgs_no_lazy']} ללא loading")
            add(pg, "B7", "fail" if n else "pass",
                "; ".join(n) or f"{p['imgs']} תמונות תקינות")

        n = []
        if p["self_links"]:
            n.append(f"{len(p['self_links'])} קישורים עצמיים")
        if p["weak_anchors"]:
            n.append(f"עוגן חלש: {p['weak_anchors'][:2]}")
        if len(p["internal_links"]) < 3:
            n.append("פחות מ-3 קישורים פנימיים")
        add(pg, "B8", "fail" if n else "pass", "; ".join(n) or
            f"{len(p['internal_links'])} פנימיים, {len(p['external_hosts'])} חיצוניים")

        if p["is_lp"]:
            add(pg, "B9", "pass", "עמוד נחיתה noindex — סכמה לא נדרשת")
        elif p["schema_errors"]:
            add(pg, "B9", "fail", "JSON-LD שגוי: " + p["schema_errors"][0])
        elif not p["schema_types"]:
            add(pg, "B9", "fail", "אין JSON-LD")
        else:
            add(pg, "B9", "pass", ", ".join(p["schema_types"][:6]))

        editorial = rel.startswith(("guides/", "in-the-news/")) and rel != "guides/index.html"
        if not editorial:
            add(pg, "B10", "pass", "אינו עמוד עריכתי")
        else:
            n = []
            if not p["author_note"]:
                n.append("אין מחבר גלוי")
            if not p["visible_date"]:
                n.append("אין תאריך עדכון גלוי")
            if not p["dateModified"]:
                n.append("אין dateModified בסכמה")
            add(pg, "B10", "fail" if n else "pass", "; ".join(n) or
                f"מחבר + תאריך גלוי + dateModified={p['dateModified'][0]}")

        add(pg, "B11", "pass" if p["cta"] else "fail",
            "טלפון/וואטסאפ בעמוד" if p["cta"] else "אין CTA")

        ok = p["lang"].startswith("he") and p["dir"].lower() == "rtl"
        add(pg, "C1", "pass" if ok else "fail", f'lang="{p["lang"]}" dir="{p["dir"]}"')

        runs = len(p["latin_runs"])
        if runs == 0:
            add(pg, "C2", "pass", "אין רצפי לטינית בתוך עברית")
        elif p["bdi"] >= runs:
            add(pg, "C2", "pass", f"{runs} רצפים, {p['bdi']} bdi")
        else:
            add(pg, "C2", "fail",
                f"{runs} רצפי לטינית ללא bdi (למשל: {', '.join(sorted(set(p['latin_runs']))[:5])})")

        if not p["title_latin"]:
            add(pg, "C3", "pass", "אין לטינית ב-title — אין סיכון bidi")
        else:
            add(pg, "C3", "unknown",
                "title מכיל לטינית; רינדור RTL בפועל ב-SERP לא נבדק")

        add(pg, "C4", "pass" if not p["niqqud_meta"] else "fail",
            "אין ניקוד" if not p["niqqud_meta"] else "ניקוד ב-meta/כותרת")

        add(pg, "C6", "unknown",
            "כיסוי וריאנטים מורפולוגיים דורש נתוני נפח חיפוש")

        # הדרישה היא שמונח לטיני יוגדר פעם אחת. מותג/ראשי-תיבות של שם עצמי
        # (ONSITE, LinkedIn) אינם דורשים הגדרה — רק בידוד, שנבדק ב-C2.
        GLOSS_NEEDED = {"Phase", "BTEX", "TPH", "TCE", "PCE", "BESS", "ESA",
                        "RBCA", "PRTR", "CEMP", "ISO"}
        needs = {r for r in p["latin_runs"] if r.split()[0] in GLOSS_NEEDED}
        if not needs:
            add(pg, "C7", "pass", "אין מונחים מקצועיים לטיניים הדורשים הגדרה")
        else:
            add(pg, "C7", "pass" if p["term_pairs"] else "fail",
                f"{p['term_pairs']} צמדי מונח עברי (Latin) עבור {sorted(needs)[:4]}")

        if p["tables"] == 0:
            add(pg, "C8", "pass", "אין טבלאות")
        else:
            add(pg, "C8", "pass" if p["tables_rtl"] == p["tables"] else "fail",
                f'{p["tables_rtl"]}/{p["tables"]} טבלאות עם dir="rtl"')

        if p["is_lp"]:
            add(pg, "C10", "pass", "עמוד נחיתה — סכמה לא נדרשת")
        else:
            n = []
            if not p["inLanguage_he"]:
                n.append("חסר inLanguage he-IL")
            if p["mojibake"]:
                n.append("UTF-8 שבור בערכי הסכמה")
            add(pg, "C10", "fail" if n else "pass", "; ".join(n) or "inLanguage he-IL, UTF-8 תקין")

        add(pg, "D3", "unknown", "מבחן חילוץ 40 מילים דורש שיפוט אנושי לכל מקטע")
        add(pg, "D4", "pass" if p["numeric_facts"] >= 8 else "fail",
            f"{p['numeric_facts']} עוגני עובדה (מספרים/שנים/תקנים)")

        if p["is_lp"]:
            add(pg, "D5", "pass", "עמוד נחיתה noindex — סכמה לא נדרשת")
        elif p["visible_faq"] and not p["has_faqpage"]:
            add(pg, "D5", "fail", "מקטע שאלות נפוצות גלוי ללא FAQPage")
        elif p["visible_faq"]:
            add(pg, "D5", "pass", "FAQ גלוי + FAQPage")
        else:
            add(pg, "D5", "unknown", "אין מקטע שאלות נפוצות בעמוד — האם צריך?")

        # "היכן שמתאים" הוא שיפוט תוכן — עובר רק אם יש טבלה/תהליך ממוספר בפועל,
        # אחרת unknown ולא fail: אי-אפשר למדוד מהקוד אם התוכן מתאים לטבלה.
        if p["tables"] or p["ordered_lists"]:
            add(pg, "D6", "pass", f"{p['tables']} טבלאות, {p['ordered_lists']} רשימות ממוספרות")
        else:
            add(pg, "D6", "unknown",
                f"אין טבלה/תהליך ממוספר ({p['lists']} רשימות תבליט) — האם התוכן מתאים לכך?")

        add(pg, "D7", "pass" if p["phone_ok"] else "fail",
            "טלפון אחיד 050-6890650" if p["phone_ok"] else "טלפון חסר/שונה")

        if p["is_lp"]:
            add(pg, "D8", "pass", "עמוד נחיתה — לא עריכתי")
        else:
            add(pg, "D8", "pass" if p["author_note"] else "fail",
                "אבירם בוצר מוזכר בשמו" if p["author_note"] else "אין מחבר בעל שם")

        add(pg, "D9", "pass" if p["authority_links"] >= 2 else "fail",
            f"{p['authority_links']} קישורים לגופים רשמיים")

        add(pg, "E2", "pass" if p["viewport"] else "fail",
            "meta viewport קיים (tap targets לא נמדדו)")
        add(pg, "E3", "pass" if p["gfont_display_swap"] and p["blocking_head_scripts"] == 0 else "fail",
            f"סקריפטים חוסמים ב-head: {p['blocking_head_scripts']}; "
            f"font-display swap: {p['gfont_display_swap']}")

        if p["dead_links"]:
            add(pg, "E4", "fail", "דומיינים מתים: " + ", ".join(p["dead_links"]))

    return rows


def live_probe():
    import ssl
    import urllib.error
    import urllib.request
    ua = {"User-Agent": "Mozilla/5.0 (compatible; SEO-GEO-Audit/1.0)"}

    class NR(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, hdrs, newurl):
            raise urllib.error.HTTPError(req.full_url, code, f"->{newurl}", hdrs, fp)

    op = urllib.request.build_opener(NR)

    def probe(u):
        try:
            r = op.open(urllib.request.Request(u, headers=ua), timeout=20)
            return r.status, None
        except urllib.error.HTTPError as e:
            return e.code, str(e.reason)
        except Exception as e:
            return None, str(e)

    http_code, http_to = probe("http://telemenv.co.il/")
    www_code, www_to = probe("https://www.telemenv.co.il/")
    nf_code, _ = probe("https://telemenv.co.il/__no_such_page__")
    https_enforced = http_code == 301
    www_301 = www_code == 301
    notes = []
    if not https_enforced:
        notes.append(f"http:// מוגש ב-{http_code} ללא 301 ל-https — "
                     "יש להפעיל Enforce HTTPS בהגדרות GitHub Pages")
    if www_301:
        notes.append("www→non-www 301 תקין")
    return {
        "https_enforced": https_enforced, "www_301": www_301,
        "a5_note": "; ".join(notes),
        "e4_ok": nf_code == 404 and os.path.exists(os.path.join(REPO, "404.html")),
        "e4_note": (f"404 מחזיר {nf_code}; "
                    + ("קיים 404.html מותאם" if os.path.exists(os.path.join(REPO, "404.html"))
                       else "אין 404.html — מוגש עמוד ברירת המחדל של GitHub באנגלית")),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", action="store_true", help="הוסף בדיקות HTTP חיות")
    a = ap.parse_args()

    pages = load_pages()
    live = live_probe() if a.live else None
    rows = evaluate(pages, live)

    out = os.path.join(REPO, "audit-ledger.csv")
    with open(out, "w", encoding="utf-8-sig", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["page", "check_id", "status", "date", "by", "note", "next_due"])
        w.writerows(rows)

    os.makedirs(os.path.join(REPO, "audit"), exist_ok=True)
    with open(os.path.join(REPO, "audit", "ledger-raw.json"), "w", encoding="utf-8") as fh:
        json.dump({k: {kk: vv for kk, vv in v.items() if kk != "text"}
                   for k, v in pages.items()}, fh, ensure_ascii=False, indent=2)

    c = Counter(r[2] for r in rows)
    print(f"pages checked : {len(pages)}")
    print(f"rows written  : {len(rows)}  ->  {out}")
    print(f"  pass    {c['pass']}")
    print(f"  fail    {c['fail']}")
    print(f"  unknown {c['unknown']}")
    print("\nfailures by check_id:")
    fc = Counter(r[1] for r in rows if r[2] == "fail")
    for cid, n in sorted(fc.items(), key=lambda x: (-x[1], x[0])):
        print(f"  {cid:5} {n:4}  {CHECKS.get(cid, '')}")


if __name__ == "__main__":
    sys.exit(main())
