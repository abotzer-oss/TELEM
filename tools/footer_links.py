#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
footer_links.py — מקור אחד לרשימת "דפים נוספים באתר".

הרשימה מופיעה בכל עמוד בארבע תבניות שונות (מקטע inline אחרי הפוטר, פוטר
Tailwind, footer-nav באודות ועמוד המחיר שמשמש תבנית לסנכרון מאופנלי).
הסקריפט בונה מחדש כל רשימה מתוך tools/footer_links.json, ושומר על העיצוב של
כל תבנית: הפריט הראשון ברשימה משמש תבנית לכל הפריטים.

הרצה:  python tools/footer_links.py          מעדכן את כל הקבצים
       python tools/footer_links.py --check  רק בודק; קוד יציאה 1 אם משהו לא מסונכרן
לא נוגע ב-/lp/ ובעמודי הפניה (meta refresh).
"""
import glob
import json
import os
import re
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINKS = json.load(open(os.path.join(REPO, "tools", "footer_links.json"), encoding="utf-8"))
ITEM = re.compile(r'(<li>)?<a href="[^"]+"[^>]*>.*?</a>(</li>)?', re.S)


def list_spans(s):
    spans = []
    for m in re.finditer(r'<h[234][^>]*>דפים נוספים באתר</h[234]>', s):
        rest = s[m.end():]
        end = re.search(r'</ul>|</div>', rest)
        spans.append((m.end(), m.end() + end.start()))
    m = re.search(r'<nav class="footer-nav"[^>]*>', s)
    if m:
        spans.append((m.end(), s.index('</nav>', m.end())))
    return spans


def rebuild(chunk):
    items = list(ITEM.finditer(chunk))
    if len(items) < 2:
        return chunk
    first, second = items[0], items[1]
    sep = chunk[first.end():second.start()]
    tpl = first.group(0)
    href = re.search(r'href="([^"]+)"', tpl).group(1)
    out = []
    for h, label in LINKS:
        t = tpl.replace(f'href="{href}"', f'href="{h}"', 1)
        t = re.sub(r'(<a [^>]*>).*?(</a>)', lambda m: m.group(1) + label + m.group(2), t, count=1, flags=re.S)
        out.append(t)
    return chunk[:first.start()] + sep.join(out) + chunk[items[-1].end():]


def files():
    for f in sorted(glob.glob(os.path.join(REPO, "**", "*.html"), recursive=True)):
        rel = os.path.relpath(f, REPO).replace(os.sep, "/")
        if rel.startswith(("lp/", "node_modules/", "audit/")):
            continue
        yield rel, f


def main(check):
    stale = []
    for rel, f in files():
        s = open(f, encoding="utf-8").read()
        if 'http-equiv="refresh"' in s:
            continue
        new = s
        for a, b in sorted(list_spans(s), reverse=True):
            new = new[:a] + rebuild(new[a:b]) + new[b:]
        if new != s:
            stale.append(rel)
            if not check:
                open(f, "w", encoding="utf-8").write(new)
    if check and stale:
        print("רשימת 'דפים נוספים באתר' לא מסונכרנת עם tools/footer_links.json:")
        for r in stale:
            print("  ", r)
        print("הרץ: python tools/footer_links.py")
        return 1
    print(f"footer_links: {'נבדקו' if check else 'עודכנו'} {len(stale) if not check else 0} קבצים")
    return 0


if __name__ == "__main__":
    sys.exit(main("--check" in sys.argv))
