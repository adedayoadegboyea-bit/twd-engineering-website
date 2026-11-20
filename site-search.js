(() => {
  const formHost = document.createElement("div");
  const root = formHost.attachShadow({mode:"open"});
  root.innerHTML = `
    <style>
      :host{display:block;background:#f4f7fc;color:#15304e}
      .search{position:relative;max-width:1180px;margin:auto;padding:.65rem 1rem;font:inherit}
      form{display:flex;gap:.45rem;align-items:center;max-width:38rem;margin:0}
      input{font:inherit;box-sizing:border-box;color:#15304e;background:white;border:1px solid #8da5c2;border-radius:.5rem;padding:.55rem .7rem;min-width:0;flex:1}
      button{font:inherit;font-weight:650;color:white;background:#0a4693;border:0;border-radius:.5rem;padding:.6rem .85rem;cursor:pointer}
      :focus-visible{outline:2px solid #2465bc;outline-offset:2px}
      .results{position:absolute;z-index:20;top:100%;left:1rem;width:min(38rem,calc(100% - 2rem));box-sizing:border-box;max-height:55vh;overflow:auto;background:white;border:1px solid #8da5c2;border-radius:.5rem;box-shadow:0 8px 24px #18335326}
      p{margin:.7rem} ul{list-style:none;margin:0;padding:0} li+li{border-top:1px solid #dde6f1}
      a{display:block;padding:.65rem .75rem;color:#0a4693;text-decoration:underline}small{display:block;margin-top:.2rem;color:#425871}
    </style>
    <div class="search">
      <form role="search" aria-label="TW&D website"><input type="search" aria-label="Search the TW&D website" placeholder="Search the TW&D website" required maxlength="120"><button type="submit">Search</button></form>
      <section class="results" aria-label="Search results" hidden><p role="status"></p><ul></ul></section>
    </div>`;
  const body = document.body;
  const header = body.querySelector(":scope > header");
  if (header) header.after(formHost); else body.prepend(formHost);

  const form = root.querySelector("form"), input = root.querySelector("input");
  const results = root.querySelector("section"), status = root.querySelector("p"), list = root.querySelector("ul");
  const fold = value => String(value ?? "").toLowerCase().normalize("NFKD").replace(/\p{M}/gu,"");
  const loadJson = async url => {
    const response = await fetch(url,{signal:AbortSignal.timeout(6000)});
    if (!response.ok) throw new Error("Search data unavailable");
    return response.json();
  };
  let index, request = 0;
  function loadIndex() {
    if (index) return index;
    index = Promise.allSettled([
      loadJson("/site-search-index.json"),
      loadJson("https://script.google.com/macros/s/AKfycbzyZ5-txUUqM-O9T0RysHtcTQDfZAz2pgERT3NeKgGSJHnNaql-ZmKmguOYP2TT1IH5/exec?action=listings")
    ]).then(([site, market]) => {
      if (site.status !== "fulfilled") { index = null; throw new Error("Search unavailable"); }
      const listings = market.status === "fulfilled" && market.value?.ok === true && Array.isArray(market.value.listings)
        ? market.value.listings.filter(item => /^TWM-[0-9-]+$/i.test(item.id ?? "") && item.title && !/^(test|demo|sample|dummy)(\s|$|[-:])/i.test(item.title.trim())).map(item => ({
            url:"/marketplace-listing.html?id="+encodeURIComponent(item.id), title:item.title,
            description:[item.location,item.category,item.description].filter(Boolean).join(" · ")
          })) : [];
      return {pages:[...site.value,...listings],marketAvailable:market.status==="fulfilled" && market.value?.ok===true};
    });
    return index;
  }
  function close() { request++; results.hidden = true; }
  root.addEventListener("keydown", event => { if (event.key === "Escape" && !results.hidden) { close(); input.focus(); } });
  document.addEventListener("pointerdown", event => { if (!event.composedPath().includes(formHost)) close(); });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const terms = fold(input.value).match(/[\p{L}\p{N}]+/gu);
    results.hidden = false;
    list.replaceChildren();
    const current = ++request;
    if (!terms) { status.textContent = "Enter a name or keyword to search."; return; }
    status.textContent = "Searching…";
    try {
      const {pages,marketAvailable} = await loadIndex();
      if (current !== request) return;
      const matches = pages.map(page => {
        const title = fold(page.title), body = fold(page.description);
        return {page, score:terms.every(term => title.includes(term) || body.includes(term))
          ? terms.reduce((score,term) => score+(title.includes(term)?3:1),0) : 0};
      }).filter(match => match.score).sort((a,b) => b.score-a.score).slice(0,12);
      status.textContent = (matches.length ? matches.length+" result"+(matches.length===1?"":"s") : "No matching pages.")
        + (marketAvailable ? "" : " Live marketplace listings are temporarily unavailable.");
      for (const {page} of matches) {
        const item = document.createElement("li"), link = document.createElement("a");
        link.href = page.url;
        link.textContent = page.title;
        if (page.description) {
          const snippet = document.createElement("small");
          snippet.textContent = page.description.length>160 ? page.description.slice(0,157)+"…" : page.description;
          link.append(snippet);
        }
        item.append(link);
        list.append(item);
      }
    } catch {
      if (current === request) status.textContent = "Search is temporarily unavailable. Try again.";
    }
  });
})();