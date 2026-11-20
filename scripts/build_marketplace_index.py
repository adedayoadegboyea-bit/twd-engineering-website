import html
import json
import re
import sys
from pathlib import Path
from urllib.request import urlopen

SITE = "https://twdengineeringconsult.com"
FEED = "https://script.google.com/macros/s/AKfycbzyZ5-txUUqM-O9T0RysHtcTQDfZAz2pgERT3NeKgGSJHnNaql-ZmKmguOYP2TT1IH5/exec?action=listings"
OUTPUT = Path("marketplace-listings")
EXCLUDED = re.compile(r"^(?:test|demo|sample|dummy)(?:\s|$|[-:])", re.I)

def clean(value):
    return " ".join(str(value or "").split())

def page(path, title, description, content):
    escape = html.escape
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)} | TW&amp;D Marketplace</title>
<meta name="description" content="{escape(description[:155])}">
<link rel="canonical" href="{SITE}/{path}">
<link rel="stylesheet" href="/marketplace.css">
<script defer src="/site-search.js"></script>
</head>
<body>
<header class="mp-header"><div class="mp-container mp-nav"><a class="mp-brand" href="/"><img src="/assets/twd-luxury-logo.svg" alt="TW&amp;D Engineering">TW&amp;D</a><nav><a href="/marketplace.html">Marketplace</a><a href="/marketplace-listings/">Approved listings</a></nav></div></header>
<main class="mp-container" style="padding-block:2rem">{content}</main>
</body>
</html>
"""

def generate(payload):
    if payload.get("ok") is not True or not isinstance(payload.get("listings"), list):
        raise ValueError("Marketplace feed did not return approved listings")
    pages = {}
    links = []
    seen = set()
    for item in payload["listings"]:
        listing_id = clean(item.get("id"))
        title = clean(item.get("title"))
        location = clean(item.get("location"))
        category = clean(item.get("category"))
        description = clean(item.get("description"))
        if not re.fullmatch(r"TWM-[0-9-]+", listing_id) or not title or EXCLUDED.match(title):
            continue
        duplicate = (title.casefold(), location.casefold(), description.casefold())
        if duplicate in seen:
            continue
        seen.add(duplicate)
        short_title = title if len(title) <= 94 else title[:91].rsplit(" ", 1)[0] + "…"
        heading = short_title if not location or location.casefold() in short_title.casefold() else f"{short_title} — {location}"
        path = f"marketplace-listings/{listing_id.lower()}.html"
        body = f"<article><h1>{html.escape(heading)}</h1>"
        if category or location:
            body += f"<p>{html.escape(' · '.join(filter(None, (category, location))))}</p>"
        if title != short_title:
            body += f"<p>{html.escape(title)}</p>"
        if description and description != title:
            body += f"<p>{html.escape(description)}</p>"
        body += f'<p><a href="/marketplace-listing.html?id={listing_id}">View current listing, photos and seller options</a></p></article>'
        pages[path] = page(path, heading, description or f"{title} {location}", body)
        links.append(f'<li><a href="/{path}">{html.escape(heading)}</a></li>')
    if not pages:
        raise ValueError("No valid approved listings. Preserve the last successful index and review the feed.")
    pages["marketplace-listings/index.html"] = page(
        "marketplace-listings/", "Approved Marketplace Listings",
        "Browse approved TW&D Marketplace properties and other listings by title and location.",
        "<h1>Approved Marketplace Listings</h1><ul>" + "\n".join(links) + "</ul>",
    )
    urls = [f"{SITE}/marketplace-listings/"] + [
        f"{SITE}/{path}" for path in pages if not path.endswith("/index.html")
    ]
    pages["sitemap-marketplace.xml"] = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(f"  <url><loc>{html.escape(url)}</loc></url>" for url in urls)
        + "\n</urlset>\n"
    )
    return pages

if __name__ == "__main__":
    if len(sys.argv) > 1:
        with open(sys.argv[1], encoding="utf-8") as response:
            pages = generate(json.load(response))
    else:
        with urlopen(FEED, timeout=45) as response:
            pages = generate(json.load(response))
    OUTPUT.mkdir(exist_ok=True)
    for filename, content in pages.items():
        Path(filename).write_text(content, encoding="utf-8")
    for previous in OUTPUT.glob("twm-*.html"):
        if previous.as_posix() not in pages:
            previous.unlink()
