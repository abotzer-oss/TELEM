#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Move the intro <p> from the מקורות section into the page body,
and move the remaining section (h2 + links) to the page bottom.
"""
import re

# Map each file to its JSX content-area class marker
FILES = [
    ("C:/Users/abotz/TELEM/env/index.html",
     'className="space-y-8 text-telem-black text-lg font-medium leading-relaxed"',
     'class="space-y-8 text-telem-black text-lg font-medium leading-relaxed"'),
    ("C:/Users/abotz/TELEM/environmental-management/index.html",
     'className="space-y-8 text-xl text-gray-800 leading-relaxed italic font-semibold"',
     'class="space-y-8 text-xl text-gray-800 leading-relaxed italic font-semibold"'),
    ("C:/Users/abotz/TELEM/history/index.html",
     'className="space-y-8 text-telem-black text-lg font-medium leading-relaxed"',
     'class="space-y-8 text-telem-black text-lg font-medium leading-relaxed"'),
    ("C:/Users/abotz/TELEM/solar/index.html",
     'className="space-y-8 text-telem-black text-lg leading-relaxed"',
     'class="space-y-8 text-telem-black text-lg leading-relaxed"'),
    ("C:/Users/abotz/TELEM/guides/index.html",
     'className="text-xl md:text-3xl text-telem-forest font-semibold max-w-4xl leading-relaxed italic"',
     'class="text-xl md:text-3xl text-telem-forest font-semibold max-w-4xl leading-relaxed italic"'),
    ("C:/Users/abotz/TELEM/guides/cities-waste.html",
     'className="content-area"', 'class="content-area"'),
    ("C:/Users/abotz/TELEM/guides/history-when.html",
     'className="content-area"', 'class="content-area"'),
    ("C:/Users/abotz/TELEM/guides/price.html",
     'className="content"', 'class="content"'),
    ("C:/Users/abotz/TELEM/guides/regulations.html",
     'className="content-area"', 'class="content-area"'),
    ("C:/Users/abotz/TELEM/guides/soil-survey-cost.html",
     'className="content-area"', 'class="content-area"'),
    ("C:/Users/abotz/TELEM/guides/soil-testing.html",
     'className="content-area"', 'class="content-area"'),
    ("C:/Users/abotz/TELEM/guides/solar-bess.html",
     'className="content-area"', 'class="content-area"'),
    ("C:/Users/abotz/TELEM/guides/timeline.html",
     'className="content-area"', 'class="content-area"'),
    ("C:/Users/abotz/TELEM/guides/urban-renewal.html",
     'className="content-area"', 'class="content-area"'),
    ("C:/Users/abotz/TELEM/guides/waste-calculation.html",
     'className="content-area"', 'class="content-area"'),
    ("C:/Users/abotz/TELEM/guides/waste-quantities.html",
     'className="content-area"', 'class="content-area"'),
    ("C:/Users/abotz/TELEM/guides/when-to-consult.html",
     'className="content-area"', 'class="content-area"'),
]

P_STYLE = 'style="font-size:1rem;line-height:1.8;margin-bottom:28px;max-width:800px;"'
SECTION_OPEN = '<section style="background:#f8f4f1;font-family:\'Assistant\',sans-serif;color:#243e38;padding:2rem;border-top:1px solid #94937f;direction:rtl;text-align:right;" aria-label="\u05de\u05e7\u05d5\u05e8\u05d5\u05ea \u05d5\u05de\u05d9\u05d3\u05e2 \u05e8\u05e9\u05de\u05d9">'
SECTION_CLOSE = '    </section>\n'


def process_file(filepath, jsx_marker, html_marker):
    print(f"\nProcessing: {filepath}")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # ── 1. Extract the intro <p> from the מקורות section ──────────────────────
    p_pattern = re.compile(
        r'        <p ' + re.escape(P_STYLE) + r'>(.*?)</p>\n',
        re.DOTALL
    )
    m = p_pattern.search(content)
    if not m:
        print(f"  ERROR: intro <p> not found — skipping")
        return

    intro_text = m.group(1).strip()
    full_p_block = m.group(0)          # includes trailing newline
    print(f"  Found intro paragraph ({len(intro_text)} chars)")

    # ── 2. Remove the <p> from the section ────────────────────────────────────
    content = content.replace(full_p_block, '', 1)

    # ── 3. Insert as <p> after first </p> inside JSX content div ─────────────
    script_start = content.find('<script type="text/babel">')
    if script_start == -1:
        print(f"  ERROR: no babel script — skipping")
        return

    marker_pos = content.find(jsx_marker, script_start)
    if marker_pos == -1:
        print(f"  ERROR: JSX marker '{jsx_marker}' not found — skipping")
        return

    first_p_close = content.find('</p>', marker_pos)
    if first_p_close == -1:
        print(f"  ERROR: no </p> after JSX marker — skipping")
        return

    ins = first_p_close + 4  # right after </p>
    new_jsx_p = f'\n                                <p>{intro_text}</p>'
    content = content[:ins] + new_jsx_p + content[ins:]
    print(f"  Inserted <p> in JSX at offset {ins}")

    # ── 4. Insert as <p> after first </p> inside pre-rendered HTML ────────────
    root_pos = content.find('<div id="root">')
    script_pos2 = content.find('<script type="text/babel">')

    html_marker_pos = content.find(html_marker, root_pos)
    if html_marker_pos == -1 or html_marker_pos >= script_pos2:
        print(f"  WARNING: HTML marker '{html_marker}' not found in root div — skipping HTML update")
    else:
        first_p_close_html = content.find('</p>', html_marker_pos)
        if first_p_close_html == -1 or first_p_close_html >= script_pos2:
            print(f"  WARNING: no </p> after HTML marker in root div — skipping HTML update")
        else:
            ins_html = first_p_close_html + 4
            new_html_p = f'<p>{intro_text}</p>'
            content = content[:ins_html] + new_html_p + content[ins_html:]
            print(f"  Inserted <p> in pre-rendered HTML at offset {ins_html}")

    # ── 5. Move the remaining section to just before </body></html> ────────────
    # Find the section (now without the <p>) from SECTION_OPEN to SECTION_CLOSE
    sec_start = content.find(SECTION_OPEN)
    if sec_start == -1:
        print(f"  ERROR: section open not found — skipping move")
        return

    sec_end = content.find(SECTION_CLOSE, sec_start)
    if sec_end == -1:
        print(f"  ERROR: section close not found — skipping move")
        return

    sec_end += len(SECTION_CLOSE)
    section_html = content[sec_start:sec_end]

    # Remove from current position
    content = content[:sec_start] + content[sec_end:]

    # Insert before </body></html>
    body_close = content.rfind('</body></html>')
    if body_close == -1:
        print(f"  ERROR: </body></html> not found — skipping move")
        return

    content = content[:body_close] + section_html + content[body_close:]
    print(f"  Moved section to bottom")

    # ── Write ─────────────────────────────────────────────────────────────────
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  Done: {filepath}")


for fp, jsx_m, html_m in FILES:
    process_file(fp, jsx_m, html_m)

print("\n=== All done ===")
