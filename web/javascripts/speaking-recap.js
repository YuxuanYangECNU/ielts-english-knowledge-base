(() => {
  const CHAT_RECAP_KEY = "ielts-speaking-chat-recaps-v1";
  const VOICE_RECAP_KEY = "ielts-speaking-voice-recaps-v1";
  const STORY_BANK_KEY = "ielts-speaking-story-bank-v1";
  const REMOTE_CHAT_DIR = "https://api.github.com/repos/YuxuanYangECNU/ielts-english-knowledge-base/contents/knowledge/speaking/practice/practice-accumulation/chat";
  const previousFetch = window.fetch.bind(window);

  function readList(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeList(key, list, limit = 100) {
    try { localStorage.setItem(key, JSON.stringify(list.slice(0, limit))); } catch (_) {}
  }

  function simpleHash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function cleanInline(text) {
    return String(text || "")
      .replace(/\*\*/g, "")
      .replace(/`/g, "")
      .replace(/^[-*•]\s*/, "")
      .trim();
  }

  function truncate(text, max = 86) {
    const value = cleanInline(text);
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  }

  function getTopic(root, mode) {
    if (mode === "chat") {
      const strong = root.querySelector("[data-chat-topic] strong");
      return String(strong?.textContent || "IELTS Speaking")
        .replace(/^Today’s IELTS topic:\s*/i, "")
        .trim();
    }
    return String(root.querySelector("[data-voice-topic]")?.textContent || "IELTS Speaking")
      .replace(/^Today’s IELTS topic:\s*/i, "")
      .replace(/\s*·\s*saved session\s*$/i, "")
      .trim();
  }

  function isRecapText(text) {
    const value = String(text || "");
    return /###\s*(关键问题|更自然的表达|有用词汇与搭配|可复用故事|口语习惯|IELTS\s*迁移|本次亮点|下次重点|Key Mistakes|Better Expressions|Useful Vocabulary|Reusable Stories|Speaking Habits|IELTS Transfer|Next Focus)/i.test(value);
  }

  function inlineFormat(text) {
    const fragment = document.createDocumentFragment();
    const parts = String(text || "").split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    parts.forEach(part => {
      if (!part) return;
      if (/^\*\*.*\*\*$/.test(part)) {
        const strong = document.createElement("strong");
        strong.textContent = part.slice(2, -2);
        fragment.appendChild(strong);
      } else if (/^`.*`$/.test(part)) {
        const code = document.createElement("code");
        code.textContent = part.slice(1, -1);
        fragment.appendChild(code);
      } else {
        fragment.appendChild(document.createTextNode(part.replace(/\*/g, "")));
      }
    });
    return fragment;
  }

  function parseRecap(text) {
    const lines = String(text || "").split(/\r?\n/);
    const sections = [];
    let current = null;

    function ensureSection() {
      if (!current) {
        current = { title: "复盘", items: [] };
        sections.push(current);
      }
      return current;
    }

    lines.forEach(raw => {
      const line = raw.trim();
      if (!line) return;
      if (/^<!--/.test(line)) return;
      if (/^#\s+/.test(line)) return;
      if (/^\*\*Mode:\*\*/i.test(line)) return;
      const heading = line.match(/^#{2,4}\s+(.+)$/);
      if (heading) {
        current = { title: heading[1].replace(/\*\*/g, "").trim(), items: [] };
        sections.push(current);
        return;
      }
      const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
      ensureSection().items.push((bullet ? bullet[1] : line).trim());
    });

    return sections.filter(section => section.items.length || section.title);
  }

  function findSection(sections, names) {
    return sections.find(section => names.some(name => new RegExp(name, "i").test(section.title)));
  }

  function mainIssueFromRecap(text) {
    const sections = parseRecap(text);
    for (const names of [["关键问题", "Key Mistakes"], ["下次重点", "Next Focus"], ["更自然的表达", "Better Expressions"]]) {
      const section = findSection(sections, names);
      if (section?.items?.length) return truncate(section.items[0], 82);
    }
    return "查看详细复盘";
  }

  function storyItemsFromRecap(text) {
    const section = findSection(parseRecap(text), ["可复用故事", "Reusable Stories"]);
    if (!section) return [];
    return section.items
      .map(item => cleanInline(item))
      .filter(item => item.length >= 12)
      .slice(0, 4);
  }

  function saveStories(topic, mode, recap, createdAt) {
    const stories = storyItemsFromRecap(recap);
    if (!stories.length) return;
    const bank = readList(STORY_BANK_KEY);
    stories.forEach(text => {
      const id = simpleHash(`${topic}|${text}`);
      if (bank.some(item => item.id === id)) return;
      bank.unshift({
        id,
        topic: topic || "IELTS Speaking",
        mode,
        text,
        createdAt: createdAt || new Date().toISOString()
      });
    });
    writeList(STORY_BANK_KEY, bank, 120);
  }

  function storyContextForCoach() {
    return readList(STORY_BANK_KEY)
      .slice(0, 10)
      .map(item => ({
        topic: String(item.topic || "").slice(0, 100),
        story: String(item.text || "").slice(0, 650)
      }))
      .filter(item => item.story);
  }

  async function parseJsonBody(input, init) {
    try {
      if (init && typeof init.body === "string") return JSON.parse(init.body);
      if (input instanceof Request) {
        const text = await input.clone().text();
        return text ? JSON.parse(text) : null;
      }
    } catch (_) {}
    return null;
  }

  // Reuse a small browser-local story bank in later website sessions without
  // publishing it to the public GitHub repository.
  window.fetch = async function speakingStoryAwareFetch(input, init = {}) {
    let url;
    try { url = new URL(typeof input === "string" ? input : input.url, window.location.href); }
    catch (_) { return previousFetch(input, init); }

    const method = String(init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (method === "POST" && (url.pathname.endsWith("/api/session/start") || url.pathname.endsWith("/api/chat"))) {
      const body = await parseJsonBody(input, init);
      if (body && !Array.isArray(body.storyBank)) {
        const storyBank = storyContextForCoach();
        if (storyBank.length) {
          return previousFetch(input, { ...init, body: JSON.stringify({ ...body, storyBank }) });
        }
      }
    }
    return previousFetch(input, init);
  };

  function makeRecapCard(text, topic, mode, dateLabel, remote = false) {
    const card = document.createElement("article");
    card.className = "speaking-recap-card";

    const header = document.createElement("header");
    header.className = "speaking-recap-header";
    const kicker = document.createElement("span");
    kicker.className = "speaking-recap-kicker";
    kicker.textContent = mode === "voice" ? "VOICE REVIEW" : "CHAT REVIEW";
    const title = document.createElement("h3");
    title.textContent = topic || "IELTS Speaking";
    const meta = document.createElement("p");
    meta.textContent = `${dateLabel || new Date().toLocaleDateString("zh-CN")} · ${mode === "voice" ? "语音实战" : "文字实战"}${remote ? " · GitHub" : ""}`;
    header.append(kicker, title, meta);
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "speaking-recap-body";
    parseRecap(text).forEach(section => {
      const block = document.createElement("section");
      block.className = "speaking-recap-section";
      const h = document.createElement("h4");
      h.textContent = section.title;
      block.appendChild(h);
      const list = document.createElement("ul");
      section.items.forEach(item => {
        const li = document.createElement("li");
        li.appendChild(inlineFormat(item));
        list.appendChild(li);
      });
      block.appendChild(list);
      body.appendChild(block);
    });
    card.appendChild(body);
    return card;
  }

  function makeRecapEntry(item) {
    const details = document.createElement("details");
    details.className = "speaking-recap-entry";

    const summary = document.createElement("summary");
    summary.className = "speaking-recap-entry-summary";
    const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString("zh-CN") : "—";

    const dateEl = document.createElement("span");
    dateEl.className = "speaking-recap-entry-date";
    dateEl.textContent = date;

    const topicEl = document.createElement("strong");
    topicEl.className = "speaking-recap-entry-topic";
    topicEl.textContent = item.topic || "IELTS Speaking";

    const issueEl = document.createElement("span");
    issueEl.className = "speaking-recap-entry-issue";
    issueEl.textContent = mainIssueFromRecap(item.recap);

    const modeEl = document.createElement("span");
    modeEl.className = "speaking-recap-entry-mode";
    modeEl.textContent = item.mode === "voice" ? "Voice" : "Chat";

    const arrow = document.createElement("span");
    arrow.className = "speaking-recap-entry-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "⌄";

    summary.append(dateEl, topicEl, issueEl, modeEl, arrow);
    details.appendChild(summary);

    const detailBody = document.createElement("div");
    detailBody.className = "speaking-recap-entry-detail";
    detailBody.appendChild(makeRecapCard(item.recap, item.topic, item.mode || "chat", date, Boolean(item.remote)));
    details.appendChild(detailBody);
    return details;
  }

  function saveRecap(mode, topic, text) {
    if (!text || !isRecapText(text)) return;
    const key = mode === "voice" ? VOICE_RECAP_KEY : CHAT_RECAP_KEY;
    const list = readList(key);
    const id = simpleHash(`${topic}|${text}`);
    const createdAt = new Date().toISOString();
    if (!list.some(item => item.id === id)) {
      list.unshift({
        id,
        topic: topic || "IELTS Speaking",
        mode,
        recap: text,
        createdAt
      });
      writeList(key, list);
    }
    saveStories(topic, mode, text, createdAt);
    window.dispatchEvent(new CustomEvent("ielts-speaking-recap-saved", { detail: { mode, id } }));
  }

  function upgradeBubble(bubble, root, mode) {
    if (!bubble || bubble.dataset.recapUpgraded === "true") return;
    const p = bubble.querySelector("p");
    const text = String(p?.textContent || "").trim();
    if (!isRecapText(text)) return;
    const topic = getTopic(root, mode);
    saveRecap(mode, topic, text);
    const card = makeRecapCard(text, topic, mode);
    bubble.dataset.recapUpgraded = "true";
    bubble.classList.add("speaking-message-recap");
    bubble.innerHTML = "";
    bubble.appendChild(card);
  }

  function watchConversation(root, mode) {
    if (!root || root.dataset.recapWatcherReady === "true") return;
    root.dataset.recapWatcherReady = "true";
    const container = root.querySelector(mode === "chat" ? "[data-chat-messages]" : "[data-voice-messages]");
    if (!container) return;

    container.querySelectorAll(".speaking-message-ai").forEach(node => upgradeBubble(node, root, mode));
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches?.(".speaking-message-ai")) upgradeBubble(node, root, mode);
          node.querySelectorAll?.(".speaking-message-ai").forEach(child => upgradeBubble(child, root, mode));
        });
      });
    });
    observer.observe(container, { childList: true, subtree: true });
  }

  function parseRemoteMarkdown(markdown, fallbackName) {
    const metaMatch = String(markdown || "").match(/<!--\s*IELTS_RECAP_META\s+(.+?)\s*-->/);
    let meta = {};
    if (metaMatch) {
      try { meta = JSON.parse(metaMatch[1]); } catch (_) {}
    }
    const recapStart = String(markdown || "").search(/^###\s+/m);
    const recap = recapStart >= 0 ? String(markdown).slice(recapStart).trim() : String(markdown || "").trim();
    return {
      id: simpleHash(`${meta.topic || fallbackName}|${recap}`),
      topic: meta.topic || "IELTS Speaking",
      mode: meta.mode || "chat",
      recap,
      createdAt: meta.date ? `${meta.date}T00:00:00+08:00` : null,
      remote: true
    };
  }

  async function loadRemoteChatRecaps() {
    try {
      const response = await fetch(REMOTE_CHAT_DIR, { headers: { "Accept": "application/vnd.github+json" } });
      if (!response.ok) return [];
      const files = await response.json();
      if (!Array.isArray(files)) return [];
      const markdownFiles = files
        .filter(file => file?.type === "file" && /\.md$/i.test(file.name || "") && file.name !== "README.md")
        .sort((a, b) => String(b.name).localeCompare(String(a.name)))
        .slice(0, 50);

      const results = await Promise.all(markdownFiles.map(async file => {
        try {
          const raw = await fetch(file.download_url, { cache: "no-store" });
          if (!raw.ok) return null;
          return parseRemoteMarkdown(await raw.text(), file.name);
        } catch (_) {
          return null;
        }
      }));
      return results.filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  function mergeRecaps(local, remote) {
    const map = new Map();
    [...remote, ...local].forEach(item => {
      const key = simpleHash(`${item.topic || ""}|${item.recap || ""}`);
      if (!map.has(key) || !map.get(key).remote) map.set(key, item);
    });
    return Array.from(map.values()).sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  async function renderAccumulation() {
    const host = document.querySelector("[data-chat-accumulation]");
    if (!host) return;
    const local = readList(CHAT_RECAP_KEY);
    const remote = await loadRemoteChatRecaps();
    const list = mergeRecaps(local, remote);
    host.innerHTML = "";

    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "speaking-recap-empty";
      empty.innerHTML = '<strong>还没有完成的 Chat 练习</strong><span>点 End practice 后，本次高价值复盘会自动出现在这里。</span>';
      host.appendChild(empty);
      return;
    }

    const note = document.createElement("p");
    note.className = "speaking-recap-local-note";
    note.textContent = remote.length
      ? "已合并当前浏览器记录与 GitHub 中已同步的 Chat 复盘；点开一条记录查看详情。"
      : "按时间查看每次 Chat 练习；点开一条记录查看完整复盘。";
    host.appendChild(note);

    const head = document.createElement("div");
    head.className = "speaking-recap-index-head";
    head.innerHTML = "<span>日期</span><span>主题</span><span>主要问题</span><span>模式</span><span></span>";
    host.appendChild(head);

    list.forEach(item => host.appendChild(makeRecapEntry(item)));
  }

  function init() {
    watchConversation(document.querySelector("[data-speaking-chat]"), "chat");
    watchConversation(document.querySelector("[data-speaking-voice]"), "voice");
    renderAccumulation();
    window.addEventListener("storage", renderAccumulation);
    window.addEventListener("ielts-speaking-recap-saved", renderAccumulation);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
