(() => {
  const config = window.IELTS_SPEAKING_CONFIG || {};
  const apiBase = (config.apiBase || "").replace(/\/$/, "");

  function setStatus(dot, label, text, kind = "") {
    if (label) label.textContent = text;
    if (dot) {
      dot.classList.remove("is-ready", "is-busy", "is-error");
      if (kind) dot.classList.add(`is-${kind}`);
    }
  }

  async function post(path, payload) {
    if (!apiBase) throw new Error("API_NOT_CONFIGURED");
    const response = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return response.json();
  }

  function appendMessage(container, role, text) {
    const item = document.createElement("div");
    item.className = `speaking-message ${role === "user" ? "speaking-message-user" : "speaking-message-ai"}`;

    const label = document.createElement("div");
    label.className = "speaking-message-label";
    label.textContent = role === "user" ? "You" : "Coach";

    const body = document.createElement("p");
    body.textContent = text;
    item.append(label, body);
    container.appendChild(item);
    container.scrollTop = container.scrollHeight;
  }

  async function initChat() {
    const root = document.querySelector("[data-speaking-chat]");
    if (!root) return;

    const status = root.querySelector("[data-chat-status]");
    const dot = root.querySelector("[data-chat-status-dot]");
    const topic = root.querySelector("[data-chat-topic]");
    const messagesEl = root.querySelector("[data-chat-messages]");
    const form = root.querySelector("[data-chat-form]");
    const input = root.querySelector("[data-chat-input]");
    const send = root.querySelector("[data-chat-send]");

    const state = { sessionId: null, topic: null, messages: [] };

    if (!apiBase) {
      setStatus(dot, status, "Waiting for API key + backend deployment", "");
      return;
    }

    try {
      setStatus(dot, status, "Preparing today’s topic…", "busy");
      const session = await post("/api/session/start", { mode: "chat" });
      state.sessionId = session.sessionId;
      state.topic = session.topic;
      const strong = topic.querySelector("strong");
      const span = topic.querySelector("span");
      if (strong) strong.textContent = `Today’s IELTS topic: ${session.topic}`;
      if (span) span.textContent = session.sourceLabel || "Recent Mainland China Speaking question bank";
      messagesEl.innerHTML = "";
      if (session.opening) appendMessage(messagesEl, "assistant", session.opening);
      setStatus(dot, status, "Ready", "ready");
    } catch (error) {
      console.error(error);
      setStatus(dot, status, "Could not start session", "error");
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || !state.sessionId) return;

      appendMessage(messagesEl, "user", text);
      state.messages.push({ role: "user", content: text });
      input.value = "";
      send.disabled = true;
      setStatus(dot, status, "Thinking…", "busy");

      try {
        const result = await post("/api/chat", {
          sessionId: state.sessionId,
          topic: state.topic,
          mode: "chat",
          messages: state.messages
        });
        if (result.reply) {
          appendMessage(messagesEl, "assistant", result.reply);
          state.messages.push({ role: "assistant", content: result.reply });
        }
        if (result.ended && result.recap) {
          appendMessage(messagesEl, "assistant", result.recap);
        }
        setStatus(dot, status, result.ended ? "Session finished" : "Ready", "ready");
      } catch (error) {
        console.error(error);
        appendMessage(messagesEl, "assistant", "The free backend is unavailable right now. Please try again later.");
        setStatus(dot, status, "Connection error", "error");
      } finally {
        send.disabled = false;
        input.focus();
      }
    });
  }

  function getBritishVoice() {
    const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    const preferred = config.preferredVoiceLang || "en-GB";
    return voices.find(v => v.lang === preferred) || voices.find(v => v.lang && v.lang.toLowerCase().startsWith("en-gb")) || voices.find(v => v.lang && v.lang.toLowerCase().startsWith("en")) || null;
  }

  function speakBritishEnglish(text) {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = config.preferredVoiceLang || "en-GB";
    const voice = getBritishVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  }

  async function initVoice() {
    const root = document.querySelector("[data-speaking-voice]");
    if (!root) return;

    const status = root.querySelector("[data-voice-status]");
    const dot = root.querySelector("[data-voice-status-dot]");
    const topic = root.querySelector("[data-voice-topic]");
    const start = root.querySelector("[data-voice-start]");
    const stop = root.querySelector("[data-voice-stop]");
    const orb = root.querySelector(".speaking-voice-orb");

    if (!apiBase) {
      setStatus(dot, status, "Waiting for ASR + model backend", "");
      start.disabled = true;
      return;
    }

    start.addEventListener("click", async () => {
      try {
        setStatus(dot, status, "Preparing today’s topic…", "busy");
        const session = await post("/api/session/start", { mode: "voice" });
        topic.textContent = `Today’s IELTS topic: ${session.topic}`;
        setStatus(dot, status, "Ready to listen", "ready");
        orb.classList.add("is-listening");
        start.disabled = true;
        stop.disabled = false;
        if (session.opening) speakBritishEnglish(session.opening);
        // Realtime ASR/WebSocket integration is added after the ASR account is connected.
      } catch (error) {
        console.error(error);
        setStatus(dot, status, "Could not start Free Voice", "error");
      }
    });

    stop.addEventListener("click", () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      orb.classList.remove("is-listening");
      setStatus(dot, status, "Stopped", "");
      start.disabled = false;
      stop.disabled = true;
    });
  }

  function init() {
    initChat();
    initVoice();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
