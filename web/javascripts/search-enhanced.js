(() => {
  const script = document.currentScript;
  const siteRoot = script?.src ? new URL("../", script.src) : new URL("./", window.location.href);
  const indexUrl = new URL("../search/search_index.json", siteRoot).toString();
  let docsPromise = null;
  let debounceTimer = null;
  let lastRenderedQuery = "";

  function normalise(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[’‘`]/g, "'")
      .replace(/[‐‑‒–—−_/\\|.,;:!?()[\]{}<>"“”]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getDocs() {
    if (!docsPromise) {
      docsPromise = fetch(indexUrl, { cache: "no-store" })
        .then(response => response.ok ? response.json() : Promise.reject(new Error(`SEARCH_INDEX_${response.status}`)))
        .then(data => Array.isArray(data?.docs) ? data.docs : [])
        .catch(error => {
          console.warn("Enhanced search index unavailable", error);
          return [];
        });
    }
    return docsPromise;
  }

  function scoreDoc(doc, query) {
    const q = normalise(query);
    if (!q) return null;
    const terms = q.split(" ").filter(Boolean);
    const title = normalise(doc.title);
    const text = normalise(doc.text);
    const haystack = `${title} ${text}`.trim();
    const exactTitle = title.includes(q);
    const exactText = text.includes(q);
    const allTerms = terms.every(term => haystack.includes(term));
    if (!exactTitle && !exactText && !allTerms) return null;

    let score = 0;
    if (exactTitle) score += 1200;
    if (exactText) score += 900;
    if (allTerms) score += 300;
    if (String(doc.location || "").includes("/listening/")) score += 5;
    return { score, exact: exactTitle || exactText };
  }

  function snippet(text, query) {
    const raw = String(text || "").replace(/\s+/g, " ").trim();
    if (!raw) return "";
    const lower = raw.toLowerCase();
    const needle = String(query || "").toLowerCase().trim();
    let index = needle ? lower.indexOf(needle) : -1;
    if (index < 0) {
      const first = needle.split(/\s+/).filter(Boolean)[0];
      index = first ? lower.indexOf(first) : -1;
    }
    if (index < 0) return raw.slice(0, 180) + (raw.length > 180 ? "…" : "");
    const start = Math.max(0, index - 70);
    const end = Math.min(raw.length, index + Math.max(needle.length, 12) + 100);
    return `${start > 0 ? "…" : ""}${raw.slice(start, end)}${end < raw.length ? "…" : ""}`;
  }

  function canonicalHref(href) {
    try {
      const url = new URL(href, window.location.href);
      url.hash = "";
      return url.href.replace(/index\.html$/i, "").replace(/\/$/, "");
    } catch (_) {
      return String(href || "");
    }
  }

  function createResult(doc, query, exact) {
    const li = document.createElement("li");
    li.className = "md-search-result__item atlas-search-result";
    li.dataset.enhancedSearchItem = "true";

    const link = document.createElement("a");
    link.className = "md-search-result__link";
    link.href = new URL(doc.location || "", siteRoot).toString();

    const article = document.createElement("article");
    article.className = "md-search-result__article md-typeset";

    const badge = document.createElement("span");
    badge.className = "atlas-search-badge";
    badge.textContent = exact ? "Exact phrase" : "Combined match";

    const title = document.createElement("h1");
    title.className = "md-search-result__title";
    title.textContent = doc.title || "Search result";

    const teaser = document.createElement("p");
    teaser.className = "md-search-result__teaser";
    teaser.textContent = snippet(doc.text, query);

    article.append(badge, title, teaser);
    link.appendChild(article);
    li.appendChild(link);
    return li;
  }

  async function augmentSearch() {
    const input = document.querySelector(".md-search__input");
    const list = document.querySelector(".md-search-result__list");
    if (!input || !list) return;

    const query = input.value.trim();
    const normalisedQuery = normalise(query);
    const terms = normalisedQuery.split(" ").filter(Boolean);

    if (normalisedQuery.length < 2) {
      list.querySelectorAll("[data-enhanced-search-item]").forEach(node => node.remove());
      lastRenderedQuery = "";
      return;
    }

    const alreadyRendered = lastRenderedQuery === normalisedQuery
      && list.querySelector("[data-enhanced-search-item]");
    if (alreadyRendered) return;

    list.querySelectorAll("[data-enhanced-search-item]").forEach(node => node.remove());
    lastRenderedQuery = normalisedQuery;

    const standardItems = Array.from(list.querySelectorAll(".md-search-result__item:not([data-enhanced-search-item])"));
    const standardCount = standardItems.length;

    // Multi-word queries always get phrase-aware supplementation. Single-word
    // queries only fall back here if MkDocs returned nothing.
    if (terms.length < 2 && standardCount > 0) return;

    const existingHrefs = new Set(
      standardItems
        .map(item => item.querySelector("a")?.href)
        .filter(Boolean)
        .map(canonicalHref)
    );

    const docs = await getDocs();
    if (normalise(input.value) !== normalisedQuery) return;

    const ranked = [];
    for (const doc of docs) {
      const match = scoreDoc(doc, query);
      if (!match) continue;
      const href = canonicalHref(new URL(doc.location || "", siteRoot).toString());
      if (existingHrefs.has(href)) continue;
      ranked.push({ doc, ...match });
    }

    ranked.sort((a, b) => b.score - a.score);
    const seen = new Set();
    const top = ranked.filter(item => {
      const key = canonicalHref(new URL(item.doc.location || "", siteRoot).toString());
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);

    for (let i = top.length - 1; i >= 0; i -= 1) {
      list.prepend(createResult(top[i].doc, query, top[i].exact));
    }
  }

  function schedule() {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(augmentSearch, 140);
  }

  function init() {
    const input = document.querySelector(".md-search__input");
    const output = document.querySelector(".md-search__output");
    if (!input || !output) return;

    input.addEventListener("input", schedule);
    input.addEventListener("focus", schedule);

    const observer = new MutationObserver(() => schedule());
    observer.observe(output, { childList: true, subtree: true });
    getDocs();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
