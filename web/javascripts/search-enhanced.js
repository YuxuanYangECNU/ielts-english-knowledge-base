(() => {
  const script = document.currentScript;
  const siteRoot = script?.src ? new URL("../", script.src) : new URL("./", window.location.href);
  const indexUrl = new URL("search/search_index.json", siteRoot).toString();
  let docsPromise = null;
  let debounceTimer = null;
  let lastRenderedQuery = "";
  const boundInputs = new WeakSet();
  const observedOutputs = new WeakSet();

  function normalise(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[’‘`]/g, "'")
      .replace(/[‐‑‒–—−_/\\|.,;:!?()[\]{}<>"“”]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasCjk(value) {
    return /[\u3400-\u9fff\uf900-\ufaff]/.test(String(value || ""));
  }

  function isMobileSearch() {
    return window.matchMedia?.("(max-width: 59.984375em)")?.matches ?? false;
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

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function appendHighlightedText(parent, text, query) {
    const raw = String(text || "");
    const exact = String(query || "").trim();
    if (!raw || !exact) {
      parent.textContent = raw;
      return;
    }

    const candidates = [exact];
    if (!raw.toLowerCase().includes(exact.toLowerCase())) {
      candidates.splice(0, 1, ...normalise(exact).split(" ").filter(Boolean));
    }
    if (!candidates.length) {
      parent.textContent = raw;
      return;
    }

    const pattern = new RegExp(`(${candidates.map(escapeRegExp).join("|")})`, "gi");
    let last = 0;
    raw.replace(pattern, (match, _group, offset) => {
      if (offset > last) parent.appendChild(document.createTextNode(raw.slice(last, offset)));
      const mark = document.createElement("mark");
      mark.className = "atlas-search-highlight";
      mark.textContent = match;
      parent.appendChild(mark);
      last = offset + match.length;
      return match;
    });
    if (last < raw.length) parent.appendChild(document.createTextNode(raw.slice(last)));
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
    badge.textContent = exact ? "Exact match" : "Combined match";

    const title = document.createElement("h1");
    title.className = "md-search-result__title";
    title.textContent = doc.title || "Search result";

    const teaser = document.createElement("p");
    teaser.className = "md-search-result__teaser";
    appendHighlightedText(teaser, snippet(doc.text, query), query);

    article.append(badge, title, teaser);
    link.appendChild(article);
    li.appendChild(link);
    return li;
  }

  function getOrCreateMobileResults() {
    const output = document.querySelector(".md-search__output");
    if (!output) return null;

    output.dataset.atlasMobileMode = "true";
    let wrapper = output.querySelector("[data-atlas-mobile-results]");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = "md-search-result atlas-mobile-search-result";
      wrapper.dataset.atlasMobileResults = "true";

      const meta = document.createElement("div");
      meta.className = "md-search-result__meta atlas-mobile-search-meta";
      meta.dataset.atlasMobileMeta = "true";

      const list = document.createElement("ol");
      list.className = "md-search-result__list atlas-mobile-search-list";
      list.dataset.atlasMobileList = "true";

      wrapper.append(meta, list);
      output.prepend(wrapper);
    }

    return {
      output,
      wrapper,
      meta: wrapper.querySelector("[data-atlas-mobile-meta]"),
      list: wrapper.querySelector("[data-atlas-mobile-list]")
    };
  }

  function clearMobileResults() {
    const output = document.querySelector(".md-search__output");
    const wrapper = output?.querySelector("[data-atlas-mobile-results]");
    if (!wrapper) return;
    const list = wrapper.querySelector("[data-atlas-mobile-list]");
    const meta = wrapper.querySelector("[data-atlas-mobile-meta]");
    if (list) list.replaceChildren();
    if (meta) meta.textContent = "";
  }

  async function augmentSearch() {
    const input = document.querySelector(".md-search__input");
    if (!input) return;

    const mobile = isMobileSearch();
    const mobileResults = mobile ? getOrCreateMobileResults() : null;
    const list = mobileResults?.list || document.querySelector(".md-search-result__list");
    if (!list) return;

    const query = input.value.trim();
    const normalisedQuery = normalise(query);
    const terms = normalisedQuery.split(" ").filter(Boolean);

    if (normalisedQuery.length < 2) {
      if (mobile) clearMobileResults();
      else list.querySelectorAll("[data-enhanced-search-item]").forEach(node => node.remove());
      lastRenderedQuery = "";
      return;
    }

    const alreadyRendered = lastRenderedQuery === normalisedQuery
      && list.querySelector("[data-enhanced-search-item]");
    if (alreadyRendered) return;

    if (mobile) list.replaceChildren();
    else list.querySelectorAll("[data-enhanced-search-item]").forEach(node => node.remove());
    lastRenderedQuery = normalisedQuery;

    const standardItems = mobile
      ? []
      : Array.from(list.querySelectorAll(".md-search-result__item:not([data-enhanced-search-item])"));
    const standardCount = standardItems.length;

    if (!mobile && terms.length < 2 && standardCount > 0 && !hasCjk(query)) return;

    // Do not de-duplicate mobile results against MkDocs' native list: on iOS the
    // native list can exist but remain invisible while the keyboard is open.
    const existingHrefs = mobile ? new Set() : new Set(
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
    }).slice(0, mobile ? 8 : 5);

    if (mobileResults?.meta) {
      mobileResults.meta.textContent = top.length
        ? `${top.length} matching result${top.length === 1 ? "" : "s"}`
        : "No matching results";
    }

    for (const item of top) {
      list.appendChild(createResult(item.doc, query, item.exact));
    }
  }

  function schedule(delay = 70) {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(augmentSearch, delay);
  }

  function bindCurrentSearch() {
    const input = document.querySelector(".md-search__input");
    const output = document.querySelector(".md-search__output");
    if (!input || !output) return false;

    if (!boundInputs.has(input)) {
      boundInputs.add(input);
      input.addEventListener("input", () => schedule());
      input.addEventListener("keyup", () => schedule());
      input.addEventListener("focus", () => schedule(0));
      input.addEventListener("compositionend", () => schedule(0));
    }

    if (!observedOutputs.has(output)) {
      observedOutputs.add(output);
      const observer = new MutationObserver(records => {
        const onlyOurResults = records.length && records.every(record => {
          const target = record.target instanceof Element ? record.target : record.target.parentElement;
          return target?.closest?.("[data-atlas-mobile-results]");
        });
        if (!onlyOurResults) schedule();
      });
      observer.observe(output, { childList: true, subtree: true });
    }

    if (!isMobileSearch()) delete output.dataset.atlasMobileMode;
    return true;
  }

  function ensureReady() {
    if (!bindCurrentSearch()) window.setTimeout(bindCurrentSearch, 120);
    getDocs();
  }

  function refreshSearchNow() {
    bindCurrentSearch();
    lastRenderedQuery = "";
    schedule(0);
  }

  function init() {
    ensureReady();

    document.addEventListener("change", event => {
      if (event.target?.matches?.('[data-md-toggle="search"]')) {
        window.setTimeout(refreshSearchNow, 0);
      }
    });

    document.addEventListener("click", event => {
      if (event.target?.closest?.('[for="__search"], .md-search__icon')) {
        window.setTimeout(refreshSearchNow, 60);
      }
    });

    window.addEventListener("pageshow", refreshSearchNow);
    window.addEventListener("orientationchange", () => window.setTimeout(refreshSearchNow, 120));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
