#!/usr/bin/env python3
"""Count, for every page on the site, how many *distinct* pages link to it.

Only <a href> links count (not <link rel=canonical/alternate>). Self-links are
ignored. Excluded as both source and target: /lp/, seo-audit, live_after.html,
node_modules.

Usage: python3 audit/count_inbound.py audit/inbound-before.csv
"""
import csv, os, re, sys
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOSTS = {"telemenv.co.il", "www.telemenv.co.il"}
EXCLUDE = re.compile(r"(^|/)(lp|node_modules)(/|$)|seo-audit|live_after\.html")


def page_url(rel):
    rel = rel.replace(os.sep, "/")
    if rel == "index.html":
        return "/"
    if rel.endswith("/index.html"):
        return "/" + rel[: -len("index.html")]
    return "/" + rel


class A(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            h = dict(attrs).get("href")
            if h:
                self.hrefs.append(h.strip())


def normalize(href, base, pages):
    if href.startswith(("mailto:", "tel:", "javascript:", "#", "data:")):
        return None
    u = urlparse(urljoin("https://telemenv.co.il" + base, href))
    if u.netloc and u.netloc not in HOSTS:
        return None
    p = u.path or "/"
    if p.endswith("/index.html"):
        p = p[: -len("index.html")]
    if p not in pages and p + "/" in pages:
        p += "/"
    if p not in pages and p + ".html" in pages:
        p += ".html"
    return p


def main(out):
    files = []
    for d, dirs, fs in os.walk(ROOT):
        dirs[:] = [x for x in dirs if not x.startswith(".")]
        for f in fs:
            if f.endswith(".html"):
                rel = os.path.relpath(os.path.join(d, f), ROOT).replace(os.sep, "/")
                if not EXCLUDE.search(rel) and not rel.startswith("audit/"):
                    files.append(rel)
    pages = {page_url(r): r for r in files}
    inbound = {p: set() for p in pages}
    broken = []
    for rel in sorted(files):
        src = page_url(rel)
        a = A()
        a.feed(open(os.path.join(ROOT, rel), encoding="utf-8").read())
        for h in a.hrefs:
            t = normalize(h, src, pages)
            if t is None or EXCLUDE.search(t) or t == src:
                continue
            if t in inbound:
                inbound[t].add(src)
            elif not os.path.splitext(t)[1] or t.endswith(".html"):
                broken.append((src, h))
    with open(out, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["page", "file", "inbound_pages", "linked_from"])
        for p in sorted(pages, key=lambda p: (len(inbound[p]), p)):
            w.writerow([p, pages[p], len(inbound[p]), " ".join(sorted(inbound[p]))])
    for src, h in broken:
        print(f"BROKEN: {src} -> {h}", file=sys.stderr)
    print(f"wrote {out}: {len(pages)} pages, {len(broken)} broken internal links")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "audit/inbound.csv")
