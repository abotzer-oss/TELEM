#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Move the מקורות section to page bottom for files that have no intro <p>."""

SECTION_OPEN = '<section style="background:#f8f4f1;font-family:\'Assistant\',sans-serif;color:#243e38;padding:2rem;border-top:1px solid #94937f;direction:rtl;text-align:right;" aria-label="\u05de\u05e7\u05d5\u05e8\u05d5\u05ea \u05d5\u05de\u05d9\u05d3\u05e2 \u05e8\u05e9\u05de\u05d9">'
SECTION_CLOSE = '    </section>\n'

FILES = [
    "C:/Users/abotz/TELEM/guides/regulations.html",
    "C:/Users/abotz/TELEM/guides/solar-bess.html",
]

for filepath in FILES:
    print(f"Processing: {filepath}")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    sec_start = content.find(SECTION_OPEN)
    if sec_start == -1:
        print(f"  ERROR: section not found — skipping")
        continue

    sec_end = content.find(SECTION_CLOSE, sec_start)
    if sec_end == -1:
        print(f"  ERROR: section close not found — skipping")
        continue

    sec_end += len(SECTION_CLOSE)
    section_html = content[sec_start:sec_end]

    content = content[:sec_start] + content[sec_end:]

    body_close = content.rfind('</body></html>')
    if body_close == -1:
        print(f"  ERROR: </body></html> not found — skipping")
        continue

    content = content[:body_close] + section_html + content[body_close:]

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  Done")

print("=== Done ===")
