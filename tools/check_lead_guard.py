#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
בדיקת שלמות לטפסי לידים — שומרת שאף ליד ריק לא יוכל להישלח מהאתר.

הרקע: ב-26.9.2026 הגיע ליד עם כל שדות המעקב מלאים וכל שדות הגולש ריקים.
הסיבה: הטפסים נשאו novalidate, וה-handler ב-JS עשה preventDefault() ואז
fetch בלי checkValidity() — כלומר כל ה-required היו קוד מת, וכל לחיצה
מקרית על הכפתור שלחה טופס ריק.

הבדיקה הזו נועדה למנוע חזרה של המצב הזה. הסכנה המרכזית היא
`npm run prerender`, שדורס index.html ו-guides/index.html מה-DOM
המרונדר ועלול להשמיט תגיות script.

כל טופס ששולח ל-api.web3forms.com חייב:
  1. לא לשאת novalidate
  2. required על השדות name ו-phone
  3. שהעמוד שמכיל אותו טוען את /assets/lead-guard.js
  4. שדה honeypot בשם botcheck

הרצה:  python tools/check_lead_guard.py
יציאה: 0 = תקין, 1 = נמצאה בעיה (ואז הפירוט מודפס).
"""

import io
import os
import re
import sys

# הקונסולה של Windows ברירת־מחדל cp1252 ולא יודעת לכתוב עברית
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):
        pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ספריות שאינן חלק מהאתר החי — תמונות מצב, גיבויים וסביבות וירטואליות
SKIP_DIRS = {'node_modules', '.git', '.venv', 'audit', 'seo-audit', 'Claude outputs'}
SKIP_FILES = {'live_after.html'}

ENDPOINT = 'api.web3forms.com'
GUARD_SRC = '/assets/lead-guard.js'

FORM_RE = re.compile(r'<form\b[^>]*>', re.I)


def html_files():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            if fn.lower().endswith('.html') and fn not in SKIP_FILES:
                yield os.path.join(dirpath, fn)


def form_body(html, start):
    """גוף הטופס מתגית הפתיחה עד </form> — כדי לבדוק שדות של הטופס הנכון."""
    end = html.find('</form>', start)
    return html[start:end if end != -1 else len(html)]


def field_has_required(body, name):
    """האם קיים שדה בשם הזה, ואם כן — האם הוא נושא required."""
    pat = re.compile(r'<(?:input|textarea|select)\b[^>]*\bname=["\']' + re.escape(name) + r'["\'][^>]*>', re.I)
    m = pat.search(body)
    if not m:
        return None                       # השדה לא קיים בטופס הזה
    return bool(re.search(r'\brequired\b', m.group(0), re.I))


def check_file(path):
    rel = os.path.relpath(path, ROOT).replace('\\', '/')
    problems = []
    try:
        html = io.open(path, encoding='utf-8', errors='replace').read()
    except OSError as exc:
        return ['%s — לא ניתן לקרוא את הקובץ: %s' % (rel, exc)]

    lead_forms = 0
    for m in FORM_RE.finditer(html):
        tag = m.group(0)
        body = form_body(html, m.start())
        # רק טפסים ששולחים לידים בפועל
        if ENDPOINT not in tag and ENDPOINT not in body:
            continue
        lead_forms += 1
        ident = re.search(r'\bid=["\']([^"\']+)["\']', tag)
        ident = ident.group(1) if ident else 'טופס #%d' % lead_forms

        if re.search(r'\bnovalidate\b', tag, re.I):
            problems.append('%s :: %s — נושא novalidate. הדפדפן לא יחסום טופס ריק אם ה-JS ייפול.'
                            % (rel, ident))

        for field in ('name', 'phone'):
            state = field_has_required(body, field)
            if state is None:
                problems.append('%s :: %s — חסר שדה בשם "%s".' % (rel, ident, field))
            elif not state:
                problems.append('%s :: %s — לשדה "%s" אין required.' % (rel, ident, field))

        if not re.search(r'name=["\']botcheck["\']', body, re.I):
            problems.append('%s :: %s — אין שדה honeypot בשם botcheck.' % (rel, ident))

    if lead_forms and GUARD_SRC not in html:
        problems.append('%s — מכיל %d טופס/י לידים אבל לא טוען %s. '
                        'אם הרצת npm run prerender, התגית כנראה נמחקה.'
                        % (rel, lead_forms, GUARD_SRC))

    return problems


def main():
    problems = []
    checked = 0
    for path in sorted(html_files()):
        found = check_file(path)
        if found:
            problems.extend(found)
        checked += 1

    guard_path = os.path.join(ROOT, 'assets', 'lead-guard.js')
    if not os.path.exists(guard_path):
        problems.append('assets/lead-guard.js חסר — כל הוולידציה של הטפסים תלויה בו.')

    if problems:
        sys.stderr.write('\n=== בדיקת טפסי לידים נכשלה ===\n')
        for p in problems:
            sys.stderr.write('  ✗ ' + p + '\n')
        sys.stderr.write('\nראה tools/check_lead_guard.py להסבר על כל כלל.\n')
        return 1

    print('בדיקת טפסי לידים: תקין (%d קבצי HTML נבדקו).' % checked)
    return 0


if __name__ == '__main__':
    sys.exit(main())
