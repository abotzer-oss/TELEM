"""
Inject mobile CTA bottom banner into all HTML pages.
- Hides .whatsapp-float on mobile (max-width: 768px)
- Adds a fixed 56px bottom bar with WhatsApp (right) + Call (left) buttons
- Safe to run multiple times (skips files already injected)
"""
import os, re

ROOT = os.path.dirname(os.path.abspath(__file__))

HTML_FILES = [
    "index.html",
    "about.html",
    "env/index.html",
    "environmental-management/index.html",
    "guides/cities-waste.html",
    "guides/history-when.html",
    "guides/index.html",
    "guides/price.html",
    "guides/regulations.html",
    "guides/soil-survey-cost.html",
    "guides/soil-testing.html",
    "guides/solar-bess.html",
    "guides/timeline.html",
    "guides/urban-renewal.html",
    "guides/waste-calculation.html",
    "guides/waste-quantities.html",
    "guides/when-to-consult.html",
    "history/index.html",
    "solar/index.html",
    "waste/index.html",
]

CSS_BLOCK = """<style id="mobile-cta-styles">
@media (max-width: 768px) {
  .whatsapp-float { display: none !important; }
}
#mobile-cta-banner {
  display: none;
  position: fixed;
  bottom: 0; left: 0; right: 0;
  width: 100%; height: 56px;
  z-index: 9999;
  background: #243e38;
  border-top: 3px solid #78836a;
  direction: rtl;
}
@media (max-width: 768px) {
  #mobile-cta-banner { display: flex; align-items: stretch; }
  body { padding-bottom: 56px !important; }
}
#mobile-cta-banner a {
  display: flex; align-items: center; justify-content: center;
  gap: 8px; width: 50%; height: 100%;
  color: #f8f4f1;
  font-family: 'Assistant', sans-serif;
  font-weight: 800; font-size: 15px;
  text-decoration: none;
  background: #243e38;
  transition: background 0.15s;
  -webkit-tap-highlight-color: transparent;
}
#mobile-cta-banner a:hover,
#mobile-cta-banner a:active { background: #475d4b; }
#mobile-cta-banner .mcta-divider {
  width: 1px; height: 60%; align-self: center;
  background: #475d4b; flex-shrink: 0;
}
#mobile-cta-banner svg { width: 20px; height: 20px; flex-shrink: 0; }
#mobile-cta-banner span { white-space: nowrap; }
</style>"""

HTML_BLOCK = """<div id="mobile-cta-banner" role="navigation" aria-label="צרו קשר מהיר">
  <a href="https://wa.me/972506890650" target="_blank" rel="noopener noreferrer" aria-label="שלחו הודעה ב-WhatsApp">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>
    <span>וואטסאפ</span>
  </a>
  <div class="mcta-divider" aria-hidden="true"></div>
  <a href="tel:0506890650" aria-label="חייגו אלינו">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/></svg>
    <span>חייגו אלינו</span>
  </a>
</div>"""

SENTINEL = 'id="mobile-cta-styles"'

def inject(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        html = f.read()

    if SENTINEL in html:
        print(f"  SKIP (already injected): {filepath}")
        return

    # Insert CSS before </head> (case-insensitive, handles both </head> and </HEAD>)
    head_match = re.search(r'</head>', html, re.IGNORECASE)
    if head_match:
        pos = head_match.start()
        html = html[:pos] + "\n" + CSS_BLOCK + "\n" + html[pos:]
    else:
        # No </head> found — prepend CSS at the top
        html = CSS_BLOCK + "\n" + html

    # Insert HTML before </body> (case-insensitive)
    body_match = re.search(r'</body>', html, re.IGNORECASE)
    if body_match:
        pos = body_match.start()
        html = html[:pos] + "\n" + HTML_BLOCK + "\n" + html[pos:]
    else:
        html = html + "\n" + HTML_BLOCK

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"  OK: {filepath}")

if __name__ == "__main__":
    for rel in HTML_FILES:
        full = os.path.join(ROOT, rel)
        if os.path.exists(full):
            inject(full)
        else:
            print(f"  MISSING: {full}")
    print("Done.")
