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

  async function post(path, payload, signal) {
    if (!apiBase) throw new Error("API_NOT_CONFIGURED");
    const response = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal
    });
    if (!response.ok) {
      let detail = "";
      try { detail = await response.text(); } catch (_) {}
      throw new Error(`HTTP_${response.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`);
    }
    return response.json();
  }

  function appendMessage(container, role, text) {
    if (!container || !text) return null;
    const placeholder = container.querySelector(".speaking-empty-state");
    if (placeholder) placeholder.remove();

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
    return item;
  }

  function isEndCommand(text) {
    return String(text || "")
      .trim()
      .replace(/[。.!！?？,，\s]+$/g, "") === "结束今天的练习";
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
      setStatus(dot, status, "Waiting for backend configuration", "");
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
      if (session.opening) {
        appendMessage(messagesEl, "assistant", session.opening);
        state.messages.push({ role: "assistant", content: session.opening });
      }
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
          if (!result.ended) state.messages.push({ role: "assistant", content: result.reply });
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
    const preferred = (config.preferredVoiceLang || "en-GB").toLowerCase();
    return voices.find(v => (v.lang || "").toLowerCase() === preferred)
      || voices.find(v => (v.lang || "").toLowerCase().startsWith("en-gb"))
      || voices.find(v => (v.lang || "").toLowerCase().startsWith("en"))
      || null;
  }

  function cancelSpeech(state) {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (state) {
      state.aiSpeaking = false;
      state.currentSpokenText = "";
    }
  }

  function speakBritishEnglish(text, state, onStatus) {
    if (!window.speechSynthesis || !text) return;
    cancelSpeech(state);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = config.preferredVoiceLang || "en-GB";
    const voice = getBritishVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 1.0;

    if (state) state.currentSpokenText = text;
    utterance.onstart = () => {
      if (state) state.aiSpeaking = true;
      if (onStatus) onStatus("Coach speaking — you can interrupt", "busy");
    };
    const finish = () => {
      if (state) {
        state.aiSpeaking = false;
        state.currentSpokenText = "";
      }
      if (onStatus && state && !state.sessionEnded && !state.stopping) onStatus("Listening…", "ready");
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
  }

  function normaliseForEcho(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff\s']/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function looksLikeEcho(heard, spoken) {
    const a = normaliseForEcho(heard);
    const b = normaliseForEcho(spoken);
    if (!a || !b) return false;
    if (a.length >= 4 && b.includes(a)) return true;
    if (b.length >= 4 && a.includes(b)) return true;

    const aTokens = a.split(" ").filter(Boolean);
    const bSet = new Set(b.split(" ").filter(Boolean));
    if (!aTokens.length || !bSet.size) return false;
    const matched = aTokens.filter(token => bSet.has(token)).length;
    return aTokens.length >= 2 && matched / aTokens.length >= 0.72;
  }

  function makeTaskId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function toWebSocketUrl(path) {
    const url = new URL(`${apiBase}${path}`);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
  }

  function float32ToPcm16(float32) {
    const output = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, float32[i]));
      output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return output.buffer;
  }

  async function startMicrophone(state) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("MICROPHONE_NOT_SUPPORTED");
    }

    state.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error("AUDIO_CONTEXT_NOT_SUPPORTED");

    state.audioContext = new AudioContextClass();
    if (state.audioContext.state === "suspended") await state.audioContext.resume();
    state.sampleRate = Math.round(state.audioContext.sampleRate);

    state.audioSource = state.audioContext.createMediaStreamSource(state.mediaStream);
    state.audioProcessor = state.audioContext.createScriptProcessor(2048, 1, 1);
    state.audioMute = state.audioContext.createGain();
    state.audioMute.gain.value = 0;

    state.audioProcessor.onaudioprocess = event => {
      if (!state.taskStarted || !state.asrSocket || state.asrSocket.readyState !== WebSocket.OPEN || state.stopping) return;
      if (state.asrSocket.bufferedAmount > 1024 * 1024) return;
      const mono = event.inputBuffer.getChannelData(0);
      try { state.asrSocket.send(float32ToPcm16(mono)); } catch (_) {}
    };

    state.audioSource.connect(state.audioProcessor);
    state.audioProcessor.connect(state.audioMute);
    state.audioMute.connect(state.audioContext.destination);
    return state.sampleRate;
  }

  function makeRunTask(taskId, sampleRate) {
    return {
      header: {
        action: "run-task",
        task_id: taskId,
        streaming: "duplex"
      },
      payload: {
        task_group: "audio",
        task: "asr",
        function: "recognition",
        model: "paraformer-realtime-v2",
        parameters: {
          format: "pcm",
          sample_rate: sampleRate,
          disfluency_removal_enabled: false,
          language_hints: ["en", "zh"],
          semantic_punctuation_enabled: false,
          max_sentence_silence: 1000,
          punctuation_prediction_enabled: true,
          heartbeat: true
        },
        input: {}
      }
    };
  }

  function makeFinishTask(taskId) {
    return {
      header: {
        action: "finish-task",
        task_id: taskId,
        streaming: "duplex"
      },
      payload: { input: {} }
    };
  }

  async function openAsrSocket(state, handlers) {
    const { onStatus, onInterim, onFinal, onFatal } = handlers;
    state.taskId = makeTaskId();
    const ws = new WebSocket(toWebSocketUrl("/api/asr"));
    ws.binaryType = "arraybuffer";
    state.asrSocket = ws;

    await new Promise((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error("ASR_START_TIMEOUT"));
          try { ws.close(); } catch (_) {}
        }
      }, 10000);

      ws.addEventListener("open", () => {
        onStatus("Connecting speech recognition…", "busy");
        ws.send(JSON.stringify(makeRunTask(state.taskId, state.sampleRate)));
      });

      ws.addEventListener("message", event => {
        if (typeof event.data !== "string") return;
        let data;
        try { data = JSON.parse(event.data); } catch (_) { return; }
        const eventName = data?.header?.event;

        if (eventName === "task-started") {
          state.taskStarted = true;
          if (!settled) {
            settled = true;
            window.clearTimeout(timeout);
            resolve();
          }
          return;
        }

        if (eventName === "result-generated") {
          const sentence = data?.payload?.output?.sentence;
          if (!sentence || sentence.heartbeat) return;
          const text = String(sentence.text || "").trim();
          if (!text) return;
          if (sentence.sentence_end) onFinal(text);
          else onInterim(text);
          return;
        }

        if (eventName === "task-failed") {
          const message = data?.header?.error_message || "Speech recognition failed";
          if (!settled) {
            settled = true;
            window.clearTimeout(timeout);
            reject(new Error(message));
          } else {
            onFatal(message);
          }
        }
      });

      ws.addEventListener("error", () => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timeout);
          reject(new Error("ASR_SOCKET_ERROR"));
        } else {
          onFatal("Speech recognition connection error");
        }
      });

      ws.addEventListener("close", () => {
        state.taskStarted = false;
        if (!settled) {
          settled = true;
          window.clearTimeout(timeout);
          reject(new Error("ASR_SOCKET_CLOSED"));
        } else if (!state.stopping && !state.sessionEnded) {
          onFatal("Speech recognition disconnected");
        }
      });
    });
  }

  async function stopVoiceCapture(state, abortRequest = true) {
    if (state.stopping) return;
    state.stopping = true;

    if (state.turnTimer) {
      window.clearTimeout(state.turnTimer);
      state.turnTimer = null;
    }
    if (abortRequest && state.activeController) {
      try { state.activeController.abort(); } catch (_) {}
      state.activeController = null;
    }

    if (state.asrSocket && state.asrSocket.readyState === WebSocket.OPEN && state.taskStarted) {
      try { state.asrSocket.send(JSON.stringify(makeFinishTask(state.taskId))); } catch (_) {}
    }

    if (state.audioProcessor) {
      try { state.audioProcessor.disconnect(); } catch (_) {}
      state.audioProcessor.onaudioprocess = null;
    }
    if (state.audioSource) {
      try { state.audioSource.disconnect(); } catch (_) {}
    }
    if (state.audioMute) {
      try { state.audioMute.disconnect(); } catch (_) {}
    }
    if (state.mediaStream) {
      state.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (state.audioContext) {
      try { await state.audioContext.close(); } catch (_) {}
    }

    const socket = state.asrSocket;
    window.setTimeout(() => {
      try {
        if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "session stopped");
      } catch (_) {}
    }, 500);
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
    const messagesEl = root.querySelector("[data-voice-messages]");
    const interimEl = root.querySelector("[data-voice-interim]");

    let state = null;

    function voiceStatus(text, kind = "") {
      setStatus(dot, status, text, kind);
    }

    function setInterim(text = "") {
      if (!interimEl) return;
      interimEl.textContent = text ? `Hearing: ${text}` : "Listening for your English…";
      interimEl.classList.toggle("has-text", Boolean(text));
    }

    function resetState() {
      return {
        sessionId: null,
        topic: null,
        messages: [],
        sessionEnded: false,
        stopping: false,
        aiSpeaking: false,
        currentSpokenText: "",
        mediaStream: null,
        audioContext: null,
        audioSource: null,
        audioProcessor: null,
        audioMute: null,
        sampleRate: 16000,
        asrSocket: null,
        taskId: null,
        taskStarted: false,
        turnTimer: null,
        pendingFinalText: "",
        activeController: null,
        requestVersion: 0
      };
    }

    async function finishUi(message = "Stopped") {
      if (!state) return;
      cancelSpeech(state);
      await stopVoiceCapture(state);
      orb.classList.remove("is-listening", "is-speaking");
      start.disabled = false;
      stop.disabled = true;
      setInterim("");
      voiceStatus(message, state.sessionEnded ? "ready" : "");
    }

    async function sendVoiceTurn(text) {
      if (!state || state.sessionEnded || !text) return;

      appendMessage(messagesEl, "user", text);
      state.messages.push({ role: "user", content: text });
      setInterim("");

      if (state.activeController) {
        try { state.activeController.abort(); } catch (_) {}
      }
      const controller = new AbortController();
      state.activeController = controller;
      const requestVersion = ++state.requestVersion;
      const ending = isEndCommand(text);
      voiceStatus(ending ? "Preparing your review…" : "Thinking…", "busy");

      if (ending) {
        state.sessionEnded = true;
        cancelSpeech(state);
        await stopVoiceCapture(state, false);
        orb.classList.remove("is-listening", "is-speaking");
      }

      try {
        const result = await post("/api/chat", {
          sessionId: state.sessionId,
          topic: state.topic,
          mode: "voice",
          messages: state.messages
        }, controller.signal);

        if (!state || requestVersion !== state.requestVersion) return;
        state.activeController = null;

        if (result.reply) {
          appendMessage(messagesEl, "assistant", result.reply);
          if (!result.ended) state.messages.push({ role: "assistant", content: result.reply });
        }

        if (result.ended) {
          state.sessionEnded = true;
          start.disabled = false;
          stop.disabled = true;
          voiceStatus("Session finished — review ready", "ready");
          return;
        }

        if (result.reply) {
          orb.classList.remove("is-listening");
          orb.classList.add("is-speaking");
          speakBritishEnglish(result.reply, state, (textStatus, kind) => {
            voiceStatus(textStatus, kind);
            if (textStatus === "Listening…") {
              orb.classList.remove("is-speaking");
              orb.classList.add("is-listening");
            }
          });
        } else {
          voiceStatus("Listening…", "ready");
        }
      } catch (error) {
        if (error && error.name === "AbortError") return;
        console.error(error);
        appendMessage(messagesEl, "assistant", "The free voice backend hit a connection error. Please stop and start a new session.");
        voiceStatus("Connection error", "error");
      }
    }

    function flushFinalText() {
      if (!state) return;
      const text = state.pendingFinalText.trim();
      state.pendingFinalText = "";
      state.turnTimer = null;
      if (text) sendVoiceTurn(text);
    }

    function onInterim(text) {
      if (!state || state.sessionEnded) return;
      if (state.aiSpeaking) {
        if (looksLikeEcho(text, state.currentSpokenText)) return;
        cancelSpeech(state);
        orb.classList.remove("is-speaking");
        orb.classList.add("is-listening");
        voiceStatus("Interrupted — listening…", "ready");
      }
      setInterim(text);
    }

    function onFinal(text) {
      if (!state || state.sessionEnded) return;
      if (state.aiSpeaking && looksLikeEcho(text, state.currentSpokenText)) {
        setInterim("");
        return;
      }
      if (state.aiSpeaking) cancelSpeech(state);
      orb.classList.remove("is-speaking");
      orb.classList.add("is-listening");

      state.pendingFinalText = state.pendingFinalText
        ? `${state.pendingFinalText} ${text}`
        : text;
      setInterim(text);

      if (state.turnTimer) window.clearTimeout(state.turnTimer);
      if (isEndCommand(text)) flushFinalText();
      else state.turnTimer = window.setTimeout(flushFinalText, 380);
    }

    if (!apiBase) {
      voiceStatus("Waiting for backend configuration", "");
      start.disabled = true;
      return;
    }

    start.addEventListener("click", async () => {
      state = resetState();
      start.disabled = true;
      stop.disabled = false;
      if (messagesEl) messagesEl.innerHTML = '<p class="speaking-empty-state">Starting your speaking session…</p>';

      try {
        voiceStatus("Preparing today’s topic…", "busy");
        const session = await post("/api/session/start", { mode: "voice" });
        state.sessionId = session.sessionId;
        state.topic = session.topic;
        topic.textContent = `Today’s IELTS topic: ${session.topic}`;

        voiceStatus("Requesting microphone…", "busy");
        await startMicrophone(state);

        voiceStatus("Connecting speech recognition…", "busy");
        await openAsrSocket(state, {
          onStatus: voiceStatus,
          onInterim,
          onFinal,
          onFatal: async message => {
            console.error(message);
            voiceStatus(message, "error");
            await finishUi("Speech recognition disconnected");
          }
        });

        if (messagesEl) messagesEl.innerHTML = "";
        if (session.opening) {
          appendMessage(messagesEl, "assistant", session.opening);
          state.messages.push({ role: "assistant", content: session.opening });
        }

        orb.classList.add("is-listening");
        setInterim("");
        voiceStatus("Listening…", "ready");

        if (session.opening) {
          orb.classList.remove("is-listening");
          orb.classList.add("is-speaking");
          speakBritishEnglish(session.opening, state, (textStatus, kind) => {
            voiceStatus(textStatus, kind);
            if (textStatus === "Listening…") {
              orb.classList.remove("is-speaking");
              orb.classList.add("is-listening");
            }
          });
        }
      } catch (error) {
        console.error(error);
        const message = error?.name === "NotAllowedError"
          ? "Microphone permission was denied"
          : "Could not start Free Voice";
        appendMessage(messagesEl, "assistant", message === "Microphone permission was denied"
          ? "Please allow microphone access in your browser, then try again."
          : "Free Voice could not connect. Check the ASR backend and try again.");
        voiceStatus(message, "error");
        if (state) await finishUi(message);
      }
    });

    stop.addEventListener("click", async () => {
      if (!state) return;
      await finishUi("Stopped");
    });
  }

  function init() {
    initChat();
    initVoice();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
