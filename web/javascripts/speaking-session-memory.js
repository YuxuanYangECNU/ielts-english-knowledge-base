(() => {
  const CHAT_KEY = "ielts-speaking-active-chat-v1";
  const VOICE_KEY = "ielts-speaking-active-voice-v1";
  const CHAT_DRAFT_KEY = "ielts-speaking-chat-draft-v1";
  const originalFetch = window.fetch.bind(window);

  function keyForMode(mode) {
    return mode === "voice" ? VOICE_KEY : CHAT_KEY;
  }

  function readSession(mode) {
    try {
      const raw = localStorage.getItem(keyForMode(mode));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.ended || !parsed.sessionId || !parsed.topic) return null;
      parsed.messages = Array.isArray(parsed.messages) ? parsed.messages : [];
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function writeSession(mode, value) {
    try {
      const safe = {
        sessionId: value.sessionId,
        topic: value.topic,
        sourceLabel: value.sourceLabel || "Recent Mainland China Speaking topic bank",
        messages: Array.isArray(value.messages) ? value.messages.slice(-80) : [],
        updatedAt: Date.now(),
        ended: false
      };
      localStorage.setItem(keyForMode(mode), JSON.stringify(safe));
    } catch (_) {}
  }

  function clearSession(mode) {
    try { localStorage.removeItem(keyForMode(mode)); } catch (_) {}
  }

  function sameMessage(a, b) {
    return a && b && a.role === b.role && String(a.content || "") === String(b.content || "");
  }

  function mergeMessages(saved, incoming) {
    const a = Array.isArray(saved) ? saved : [];
    const b = Array.isArray(incoming) ? incoming : [];
    if (!a.length) return b.slice();
    if (!b.length) return a.slice();

    const max = Math.min(a.length, b.length);
    let overlap = 0;
    for (let n = max; n > 0; n -= 1) {
      let ok = true;
      for (let i = 0; i < n; i += 1) {
        if (!sameMessage(a[a.length - n + i], b[i])) {
          ok = false;
          break;
        }
      }
      if (ok) {
        overlap = n;
        break;
      }
    }
    return [...a, ...b.slice(overlap)];
  }

  function normalise(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff\s']/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function likelyEcho(userText, assistantText) {
    const a = normalise(userText);
    const b = normalise(assistantText);
    if (a.length < 12 || b.length < 12) return false;
    if (a === b || a.includes(b) || b.includes(a)) return true;
    const words = a.split(" ").filter(Boolean);
    const bWords = new Set(b.split(" ").filter(Boolean));
    if (words.length < 4) return false;
    const matched = words.filter(w => bWords.has(w)).length;
    return matched / words.length >= 0.85;
  }

  async function parseBody(input, init) {
    try {
      if (init && typeof init.body === "string") return JSON.parse(init.body);
      if (input instanceof Request) {
        const text = await input.clone().text();
        return text ? JSON.parse(text) : null;
      }
    } catch (_) {}
    return null;
  }

  function makeJsonResponse(data) {
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  window.fetch = async function patchedFetch(input, init = {}) {
    let url;
    try { url = new URL(typeof input === "string" ? input : input.url, window.location.href); }
    catch (_) { return originalFetch(input, init); }

    const method = String(init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();

    if (method === "POST" && url.pathname.endsWith("/api/session/start")) {
      const body = await parseBody(input, init);
      const mode = body?.mode === "voice" ? "voice" : "chat";
      const saved = readSession(mode);
      if (saved) {
        return makeJsonResponse({
          sessionId: saved.sessionId,
          topic: saved.topic,
          sourceLabel: saved.sourceLabel,
          opening: null,
          resumed: true
        });
      }

      const response = await originalFetch(input, init);
      if (response.ok) {
        try {
          const data = await response.clone().json();
          writeSession(mode, {
            sessionId: data.sessionId,
            topic: data.topic,
            sourceLabel: data.sourceLabel,
            messages: data.opening ? [{ role: "assistant", content: data.opening }] : []
          });
        } catch (_) {}
      }
      return response;
    }

    if (method === "POST" && url.pathname.endsWith("/api/chat")) {
      const body = await parseBody(input, init);
      if (!body) return originalFetch(input, init);
      const mode = body.mode === "voice" ? "voice" : "chat";
      const saved = readSession(mode);
      const incoming = Array.isArray(body.messages) ? body.messages : [];
      const merged = mergeMessages(saved?.messages || [], incoming);

      if (mode === "voice" && merged.length >= 2) {
        const last = merged[merged.length - 1];
        let previousAssistant = null;
        for (let i = merged.length - 2; i >= 0; i -= 1) {
          if (merged[i].role === "assistant") {
            previousAssistant = merged[i];
            break;
          }
        }
        if (last?.role === "user" && previousAssistant && likelyEcho(last.content, previousAssistant.content)) {
          window.setTimeout(() => {
            const bubbles = document.querySelectorAll("[data-voice-messages] .speaking-message-user");
            const bubble = bubbles[bubbles.length - 1];
            if (bubble && normalise(bubble.textContent).includes(normalise(last.content))) bubble.remove();
          }, 0);
          return makeJsonResponse({ reply: "", recap: null, ended: false, ignoredEcho: true });
        }
      }

      // Persist the user's outgoing turn immediately. This prevents the local
      // session-restoration observer from briefly replacing the new bubble with
      // the previous saved state while the model is still generating a reply.
      writeSession(mode, {
        sessionId: body.sessionId || saved?.sessionId,
        topic: body.topic || saved?.topic,
        sourceLabel: saved?.sourceLabel,
        messages: merged
      });

      const nextInit = { ...init, body: JSON.stringify({ ...body, messages: merged }) };
      const response = await originalFetch(input, nextInit);

      if (response.ok) {
        try {
          const data = await response.clone().json();
          if (data.ended) {
            clearSession(mode);
          } else {
            const messages = [...merged];
            if (data.reply) messages.push({ role: "assistant", content: data.reply });
            writeSession(mode, {
              sessionId: body.sessionId || saved?.sessionId,
              topic: body.topic || saved?.topic,
              sourceLabel: saved?.sourceLabel,
              messages
            });
          }
        } catch (_) {}
      }
      return response;
    }

    return originalFetch(input, init);
  };

  function createBubble(role, text) {
    const item = document.createElement("div");
    item.className = `speaking-message ${role === "user" ? "speaking-message-user" : "speaking-message-ai"}`;
    const label = document.createElement("div");
    label.className = "speaking-message-label";
    label.textContent = role === "user" ? "You" : "Coach";
    const body = document.createElement("p");
    body.textContent = text;
    item.append(label, body);
    return item;
  }

  function restoreMessages(container, messages) {
    if (!container || !Array.isArray(messages) || !messages.length) return;
    const visible = Array.from(container.querySelectorAll(".speaking-message p")).map(p => p.textContent);
    const target = messages.map(m => String(m.content || ""));
    if (visible.length === target.length && visible.every((v, i) => v === target[i])) return;

    // While a new message has just been sent, the DOM may temporarily be one
    // bubble ahead of localStorage. Never erase that newer visible bubble.
    if (visible.length > target.length && target.every((v, i) => visible[i] === v)) return;

    container.innerHTML = "";
    messages.forEach(m => container.appendChild(createBubble(m.role, m.content)));
    container.scrollTop = container.scrollHeight;
  }

  function applyRestoredUi() {
    const chat = readSession("chat");
    const chatRoot = document.querySelector("[data-speaking-chat]");
    if (chat && chatRoot) {
      const topic = chatRoot.querySelector("[data-chat-topic]");
      const strong = topic?.querySelector("strong");
      const span = topic?.querySelector("span");
      if (strong) strong.textContent = `Today’s IELTS topic: ${chat.topic}`;
      if (span) span.textContent = `${chat.sourceLabel || "Recent Mainland China Speaking topic bank"} · resumed`;
      restoreMessages(chatRoot.querySelector("[data-chat-messages]"), chat.messages);
      const status = chatRoot.querySelector("[data-chat-status]");
      const dot = chatRoot.querySelector("[data-chat-status-dot]");
      if (status && !/Thinking|Connection|Could not/i.test(status.textContent || "")) status.textContent = "Ready · resumed";
      if (dot) dot.classList.add("is-ready");
    }

    const voice = readSession("voice");
    const voiceRoot = document.querySelector("[data-speaking-voice]");
    if (voice && voiceRoot) {
      const topic = voiceRoot.querySelector("[data-voice-topic]");
      if (topic) topic.textContent = `Today’s IELTS topic: ${voice.topic} · saved session`;
      restoreMessages(voiceRoot.querySelector("[data-voice-messages]"), voice.messages);
      const strong = voiceRoot.querySelector(".speaking-voice-start-copy strong");
      const small = voiceRoot.querySelector(".speaking-voice-start-copy small");
      if (strong) strong.textContent = "Resume Free Voice";
      if (small) small.textContent = "Continue your previous topic";
    }

    const input = document.querySelector("[data-chat-input]");
    if (input) {
      try {
        const draft = localStorage.getItem(CHAT_DRAFT_KEY) || "";
        if (!input.value && draft) input.value = draft;
      } catch (_) {}
      if (!input.dataset.draftMemoryReady) {
        input.dataset.draftMemoryReady = "true";
        input.addEventListener("input", () => {
          try { localStorage.setItem(CHAT_DRAFT_KEY, input.value); } catch (_) {}
        });
        const form = document.querySelector("[data-chat-form]");
        form?.addEventListener("submit", () => {
          try { localStorage.removeItem(CHAT_DRAFT_KEY); } catch (_) {}
        });
      }
    }
  }

  function startUiSync() {
    applyRestoredUi();
    const observer = new MutationObserver(() => window.requestAnimationFrame(applyRestoredUi));
    observer.observe(document.body, { childList: true, subtree: true, characterData: false });
    window.setTimeout(applyRestoredUi, 200);
    window.setTimeout(applyRestoredUi, 800);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startUiSync);
  else startUiSync();
})();
