#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_sitemap.py — מייצר sitemap.xml מהמקור, לא מהזיכרון.

כללים:
  * רק עמודים אינדקסביליים: בלי /lp/, בלי noindex, ובלי עמוד שה-canonical
    שלו מצביע למקום אחר (למשל /history/ שהוא עמוד הפניה).
  * ה-<loc> נלקח מתוך תגית ה-canonical של העמוד עצמו, כך שכתובת ה-sitemap
    וה-canonical לא יכולות להיפרד. כתובת אחת לכל עמוד.
  * <lastmod> הוא תאריך הקומיט האחרון שנגע בקובץ — לא תאריך ההרצה.
    לקובץ שלא נכנס עדיין ל-git נלקח תאריך השינוי בדיסק.

הרצה: python tools/build_sitemap.py [--check]
  --check מאמת שהקובץ הקיים מעודכן ומחזיר קוד יציאה 1 אם לא (לשימוש ב-hook/CI).
"""
import datetime as dt
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


REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "sitemap.xml")


def git(*a):
    return subprocess.run(["git", "-C", REPO, *a], capture_output=True,
                          text=True).stdout.strip()


def _pending():
    """קבצים עם שינוי לא-מקומיט (staged או לא). הסקריפט רץ ב-pre-commit, לפני
    שהקומיט קיים — לכן קובץ שמשתנה עכשיו חייב לקבל את תאריך היום ולא את תאריך
    הקומיט הקודם, אחרת ה-sitemap יוצא מפגר בקומיט אחד."""
    out = git("status", "--porcelain", "--", "*.html")
    return {line[3:].strip().strip('"').split(" -> ")[-1]
            for line in out.splitlines() if line}


PENDING = _pending()


def last_commit_date(rel):
    if rel in PENDING:
        return dt.date.today().isoformat()
    d = git("log", "-1", "--format=%cs", "--", rel)
    if d:
        return d
    ts = os.path.getmtime(os.path.join(REPO, rel.replace("/", os.sep)))
    return dt.date.fromtimestamp(ts).isoformat()


def build():
    files = [f for f in git("ls-files", "*.html").split()
             if not f.startswith(("seo-audit/", "lp/"))]
    entries, skipped = [], []
    for rel in sorted(files):
        html = open(os.path.join(REPO, rel.replace("/", os.sep)),
                    encoding="utf-8", errors="replace").read()

        m = re.search(r'<meta[^>]+name="robots"[^>]+content="([^"]*)"', html, re.I)
        if m and "noindex" in m.group(1).lower():
            skipped.append((rel, "noindex"))
            continue

        m = re.search(r'<link[^>]+rel="canonical"[^>]+href="([^"]*)"', html, re.I)
        if not m:
            skipped.append((rel, "אין canonical"))
            continue
        canonical = m.group(1)

        # a page whose canonical points elsewhere is not its own indexable URL
        expect = "https://telemenv.co.il/" + (
            "" if rel == "index.html" else
            rel[:-len("index.html")] if rel.endswith("/index.html") else rel)
        if canonical.rstrip("/") != expect.rstrip("/"):
            skipped.append((rel, f"canonical -> {canonical}"))
            continue

        entries.append((canonical, last_commit_date(rel)))

    xml = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<!-- נוצר על ידי tools/build_sitemap.py — אין לערוך ידנית -->',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, mod in entries:
        xml += ["  <url>", f"    <loc>{loc}</loc>",
                f"    <lastmod>{mod}</lastmod>", "  </url>"]
    xml.append("</urlset>")
    return "\n".join(xml) + "\n", entries, skipped


def main():
    xml, entries, skipped = build()
    check = "--check" in sys.argv
    current = open(OUT, encoding="utf-8").read() if os.path.exists(OUT) else ""

    if check:
        if current != xml:
            print("sitemap.xml is stale — run: python tools/build_sitemap.py",
                  file=sys.stderr)
            return 1
        print(f"sitemap.xml up to date ({len(entries)} URLs)")
        return 0

    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(xml)
    print(f"wrote {len(entries)} URLs to sitemap.xml")
    for loc, mod in entries:
        print(f"  {mod}  {loc}")
    if skipped:
        print("\nexcluded:")
        for rel, why in skipped:
            print(f"  {rel:44} {why}")
    print("\n  (/lp/ excluded wholesale — noindex PPC landing pages)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
