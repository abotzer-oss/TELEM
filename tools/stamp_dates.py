#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
stamp_dates.py — שומר על תאריכי העדכון נכונים, בסכמה ובעין.

מודלים מנמיכים משקל לתוכן שנראה לא מתוארך, ו-Google דורש dateModified אמיתי
כדי לא להתעלם ממנו. לכן התאריך חייב להתעדכן אוטומטית ולא בזיכרון של מישהו.

לכל עמוד עריכתי (guides/, in-the-news/) הסקריפט מוודא:
  * שורת בייליין גלויה מתחת ל-h1:  מאת אבירם בוצר · עודכן: <חודש> <שנה>
    עם <time datetime="YYYY-MM-DD"> כדי שהתאריך יהיה קריא גם למכונה.
  * "dateModified" בסכמת ה-JSON-LD — זהה לתאריך שבבייליין.
  * "datePublished" אם חסר — לפי הקומיט הראשון שנגע בקובץ.
  * שורת הקופירייט בפוטר — לשנה הנוכחית.

מקורות התאריך:
  ברירת מחדל   — תאריך הקומיט האחרון שנגע בקובץ (מצב "תקן את מה שקיים").
  --staged     — היום, עבור קבצים ב-staging (מצב pre-commit hook).

הרצה:
  python tools/stamp_dates.py            # כל העמודים, לפי היסטוריית git
  python tools/stamp_dates.py --staged   # רק staged, חותם היום — ה-hook
  python tools/stamp_dates.py --check    # מדווח ולא כותב; קוד יציאה 1 אם יש פער
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
TODAY = dt.date.today()

MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
          "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"]

BYLINE_STYLE = ("margin:0 0 2.5rem;font-size:0.95rem;line-height:1.6;color:#475d4b;"
                "font-weight:700;direction:rtl;text-align:right;")
LINK_STYLE = "color:#1B6B3A;text-decoration:underline;"


def he_date(d):
    return f"{MONTHS[d.month - 1]} {d.year}"


def git(*a):
    return subprocess.run(["git", "-C", REPO, *a], capture_output=True,
                          text=True).stdout.strip()


def is_editorial(rel):
    return rel.startswith(("guides/", "in-the-news/"))


def last_commit(rel):
    d = git("log", "-1", "--format=%cs", "--", rel)
    return dt.date.fromisoformat(d) if d else TODAY


def first_commit(rel):
    out = git("log", "--reverse", "--format=%cs", "--", rel)
    return dt.date.fromisoformat(out.split("\n")[0]) if out else TODAY


BYLINE_RE = re.compile(r'<p class="page-updated".*?</p>', re.S)


# עמודי רכזת וכלי — תאריך עדכון כן, קרדיט מחבר לא: אין להם מחבר יחיד.
HUBS = {"guides/index.html", "in-the-news/index.html", "guides/waste-calculation.html"}


def byline(d, rel):
    author = "" if rel in HUBS else (
        f'מאת <a href="/about.html" style="{LINK_STYLE}">אבירם בוצר</a> · ')
    return (f'<p class="page-updated" style="{BYLINE_STYLE}">{author}'
            f'עודכן: <time datetime="{d.isoformat()}">{he_date(d)}</time></p>')


def stamp(rel, when, published):
    path = os.path.join(REPO, rel.replace("/", os.sep))
    html = original = open(path, encoding="utf-8").read()
    iso = when.isoformat()
    changes = []

    # 1. visible byline under the h1 — insert or refresh
    new_byline = byline(when, rel)
    if BYLINE_RE.search(html):
        if BYLINE_RE.search(html).group(0) != new_byline:
            html = BYLINE_RE.sub(lambda _: new_byline, html, count=1)
            changes.append(f"byline -> {he_date(when)}")
    else:
        m = re.search(r"</h1>", html)
        if m:
            html = html[:m.end()] + new_byline + html[m.end():]
            changes.append(f"byline added ({he_date(when)})")

    # 2. dateModified in JSON-LD
    if '"dateModified"' in html:
        def fix(m):
            return f'"dateModified": "{iso}"' if m.group(1) != iso else m.group(0)
        before = html
        html = re.sub(r'"dateModified"\s*:\s*"([^"]*)"', fix, html)
        if html != before:
            changes.append(f"dateModified -> {iso}")
    elif '"datePublished"' in html:
        html = re.sub(r'("datePublished"\s*:\s*"[^"]*")',
                      rf'\1,\n      "dateModified": "{iso}"', html, count=1)
        changes.append(f"dateModified added ({iso})")
    else:
        # no date anywhere — hang it off the page's own CreativeWork node
        m = re.search(r'("@type"\s*:\s*"(?:WebPage|WebApplication|CollectionPage|'
                      r'Article|NewsArticle|BlogPosting)")', html)
        if m:
            html = (html[:m.end()]
                    + f',\n  "datePublished": "{published.isoformat()}"'
                    + f',\n  "dateModified": "{iso}"' + html[m.end():])
            changes.append(f"datePublished+dateModified added to "
                           f"{m.group(1).split(':')[1].strip()} ({iso})")

    # 3. datePublished — only ever added, never rewritten
    if '"datePublished"' not in html and '"dateModified"' in html:
        html = re.sub(r'("dateModified"\s*:\s*"[^"]*")',
                      rf'"datePublished": "{published.isoformat()}",\n      \1',
                      html, count=1)
        changes.append(f"datePublished added ({published.isoformat()})")

    # 4. copyright year in the footer
    def year(m):
        return m.group(1) + str(TODAY.year) if m.group(2) != str(TODAY.year) else m.group(0)
    before = html
    html = re.sub(r"(&copy;\s*|©\s*)((?:19|20)\d{2})", year, html)
    if html != before:
        changes.append(f"copyright -> {TODAY.year}")

    return html if html != original else None, changes


def main():
    staged = "--staged" in sys.argv
    check = "--check" in sys.argv
    now = "--now" in sys.argv      # החתמה ראשונית: כל העמודים בתאריך היום

    if staged:
        files = [f for f in git("diff", "--cached", "--name-only",
                                "--diff-filter=ACMR").split()
                 if f.endswith(".html") and is_editorial(f)]
    else:
        files = [f for f in git("ls-files", "*.html").split() if is_editorial(f)]

    dirty = []
    for rel in sorted(files):
        when = TODAY if (staged or now) else last_commit(rel)
        new, changes = stamp(rel, when, first_commit(rel))
        if not new:
            continue
        dirty.append(rel)
        print(f"{rel}\n    " + "\n    ".join(changes))
        if not check:
            open(os.path.join(REPO, rel.replace("/", os.sep)),
                 "w", encoding="utf-8", newline="").write(new)

    if check and dirty:
        print(f"\n{len(dirty)} file(s) have stale dates — run: "
              "python tools/stamp_dates.py", file=sys.stderr)
        return 1
    print(f"\n{len(dirty)} file(s) {'would be ' if check else ''}updated "
          f"out of {len(files)} editorial page(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
