#!/usr/bin/env python3
"""Submit changed URLs to IndexNow (Bing and partner engines).

Usage:
    python3 tools/indexnow.py guides/waste-quantities.html index.html
    python3 tools/indexnow.py --all           # every URL in sitemap.xml
    python3 tools/indexnow.py --all --dry-run # print, do not send

Only .html paths are submitted. Anything under lp/ is skipped: those are
paid-landing pages and do not belong in the organic index.
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

HOST = "telemenv.co.il"
ORIGIN = "https://" + HOST + "/"
ENDPOINT = "https://api.indexnow.org/indexnow"
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY_RE = re.compile(r"^[0-9a-f]{32}\.txt$")
TIMEOUT = 30


def find_key():
    """The key file lives in the repo root and is named <key>.txt."""
    for name in sorted(os.listdir(REPO)):
        if not KEY_RE.match(name):
            continue
        with open(os.path.join(REPO, name), encoding="ascii") as fh:
            body = fh.read().strip()
        if body == name[:-4]:
            return body
    return None


def is_lp(rel):
    """Paid-landing pages stay out of the organic index."""
    return rel == "lp" or rel.startswith("lp/")


def to_url(path):
    """Repo-relative path -> absolute URL, or None if it must not be sent."""
    rel = path.replace("\\", "/").strip().lstrip("./").lstrip("/")
    if not rel.lower().endswith(".html"):
        return None
    if is_lp(rel):
        return None
    # index.html is served at the directory URL; that is what the sitemap lists.
    if rel == "index.html":
        return ORIGIN
    if rel.endswith("/index.html"):
        rel = rel[: -len("index.html")]
    return ORIGIN + rel


def sitemap_urls():
    tree = ET.parse(os.path.join(REPO, "sitemap.xml"))
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    out = []
    for loc in tree.getroot().iterfind(".//sm:url/sm:loc", ns):
        url = (loc.text or "").strip()
        # Sitemap entries are already canonical URLs (directory URLs included),
        # so they are taken as-is rather than run through the path mapper.
        if not url.startswith(ORIGIN) or is_lp(url[len(ORIGIN):]):
            continue
        out.append(url)
    return out


def submit(urls, key, dry_run):
    payload = {
        "host": HOST,
        "key": key,
        "keyLocation": ORIGIN + key + ".txt",
        "urlList": urls,
    }
    if dry_run:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return 0

    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            print("IndexNow HTTP %s for %d URL(s)" % (resp.status, len(urls)))
            return 0
    except urllib.error.HTTPError as exc:
        print("IndexNow rejected the batch: HTTP %s %s" % (exc.code, exc.reason),
              file=sys.stderr)
        detail = exc.read().decode("utf-8", "replace").strip()
        if detail:
            print(detail[:500], file=sys.stderr)
    except urllib.error.URLError as exc:
        print("IndexNow unreachable: %s" % exc.reason, file=sys.stderr)
    except OSError as exc:
        print("IndexNow request failed: %s" % exc, file=sys.stderr)
    return 1


def main():
    ap = argparse.ArgumentParser(description="Submit URLs to IndexNow.")
    ap.add_argument("paths", nargs="*", help="repo-relative file paths")
    ap.add_argument("--all", action="store_true", help="submit every sitemap URL")
    ap.add_argument("--dry-run", action="store_true", help="print the payload only")
    args = ap.parse_args()

    if args.all:
        urls = sitemap_urls()
    else:
        urls = [u for u in (to_url(p) for p in args.paths) if u]

    urls = sorted(set(urls))
    if not urls:
        print("Nothing to submit.")
        return 0

    key = find_key()
    if not key:
        print("No IndexNow key file (<32-hex>.txt) found in the repo root.",
              file=sys.stderr)
        return 1

    for u in urls:
        print("  " + u)
    return submit(urls, key, args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
