import json, re, urllib.request, urllib.parse
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET
from html import unescape

FEEDS = [
    ("PUNCH", "https://rss.punchng.com/v1/category/latest_news"),
    ("PUNCH Business", "https://rss.punchng.com/v1/category/business"),
    ("Premium Times", "https://www.premiumtimesng.com/feed"),
    ("The Guardian Nigeria", "https://guardian.ng/feed/"),
    ("The Nation", "https://thenationonlineng.net/feed/"),
    ("Daily Post Nigeria", "https://dailypost.ng/feed"),
    ("Information Nigeria", "https://www.informationng.com/feed/"),
]
KEYWORDS = {
    "engineering": ["engineering","construction","road","bridge","infrastructure","power","electricity","water","housing","building"],
    "business": ["business","economy","market","investment","finance","company","industry","trade"],
    "government": ["government","minister","ministry","agency","federal","state government","governor","assembly"],
    "property": ["property","real estate","housing","estate","land","home"],
    "oyo": ["oyo","ibadan"],
    "lagos": ["lagos"],
}
def clean(text):
    text = unescape(re.sub(r"<[^>]+>", " ", text or ""))
    return re.sub(r"\s+", " ", text).strip()
def text_of(node, names):
    for name in names:
        child = node.find(name)
        if child is not None and child.text:
            return child.text
    return ""
def parse_date(value):
    if not value: return None
    try: return parsedate_to_datetime(value).astimezone(timezone.utc).isoformat()
    except Exception:
        return None
def classify(title, summary):
    hay = (title+" "+summary).lower()
    return [k for k, words in KEYWORDS.items() if any(w in hay for w in words)]
def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent":"TW-D-Engineering-News/1.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read()
def parse_feed(source, raw):
    root = ET.fromstring(raw)
    items = root.findall(".//item")
    if not items:
        ns = "{http://www.w3.org/2005/Atom}"
        for e in root.findall(f"{ns}entry"):
            title = clean(text_of(e,[f"{ns}title"]))
            summary = clean(text_of(e,[f"{ns}summary",f"{ns}content"]))
            link_node = e.find(f"{ns}link")
            link = link_node.get("href","") if link_node is not None else ""
            date = text_of(e,[f"{ns}updated",f"{ns}published"])
            if title and link: yield title, summary, link, parse_date(date)
        return
    for item in items:
        title=clean(text_of(item,["title"]))
        summary=clean(text_of(item,["description","summary"]))
        link=text_of(item,["link"])
        date=text_of(item,["pubDate","published","date"])
        if title and link: yield title,summary,link,parse_date(date)

articles=[]
seen=set()
for source,url in FEEDS:
    try:
        for title,summary,link,published in parse_feed(source,fetch(url)):
            key=re.sub(r"\W+","",title.lower())
            if not key or key in seen: continue
            seen.add(key)
            articles.append({
                "title": title[:180],
                "summary": summary[:300],
                "url": link,
                "source": source,
                "published": published,
                "categories": classify(title,summary),
            })
    except Exception as exc:
        print(f"Feed failed: {source}: {exc}")
articles.sort(key=lambda x:x.get("published") or "", reverse=True)
payload={"generated_at":datetime.now(timezone.utc).isoformat(),"sources":[s for s,_ in FEEDS],"articles":articles[:30]}
with open("news.json","w",encoding="utf-8") as f:
    json.dump(payload,f,ensure_ascii=False,indent=2)
print(f"Wrote {len(payload['articles'])} articles.")
