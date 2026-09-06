const ZHIPU_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const MODEL = "glm-4.7-flash";
const ASR_MODEL = "paraformer-realtime-v2";
const DASHSCOPE_ASR_URL = "https://dashscope.aliyuncs.com/api-ws/v1/inference";

const ALLOWED_ORIGINS = [
  "https://yuxuanyangecnu.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000"
];

const FALLBACK_TOPICS = [
  "People & relationships",
  "Study & university life",
  "Technology in daily life",
  "Hobbies & free time",
  "Travel & places"
];

function isAllowedOrigin(origin) {
  return !origin || ALLOWED_ORIGINS.includes(origin);
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin"
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) }
  });
}

function parseTopicBank(env) {
  if (!env.IELTS_TOPIC_BANK) return FALLBACK_TOPICS;
  try {
    const parsed = JSON.parse(env.IELTS_TOPIC_BANK);
    if (Array.isArray(parsed) && parsed.length) return parsed.map(String);
  } catch (_) {}
  return FALLBACK_TOPICS;
}

function selectTopic(topics) {
  return topics[Math.floor(Math.random() * topics.length)];
}

async function callGLM(env, messages, temperature = 0.8) {
  if (!env.ZHIPU_API_KEY) throw new Error("ZHIPU_API_KEY is missing");

  const response = await fetch(ZHIPU_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.ZHIPU_API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      thinking: { type: "disabled" },
      stream: false,
      temperature,
      max_tokens: 1200
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GLM ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

function conversationSystemPrompt(topic, mode) {
  return `You are an IELTS Speaking conversation coach. The learner targets Band 7 and is preparing for IELTS in Mainland China.

Main topic for this session: ${topic}
Mode: ${mode}

Rules:
- Speak mainly in natural English, like a friendly native English-speaking conversation partner rather than a rigid examiner.
- Stay on one main topic and deepen it naturally.
- Keep the topic clearly related to IELTS Speaking Part 1/2/3 ideas without mechanically firing exam questions.
- Let the learner finish a turn before correcting.
- Only when an error is important enough to correct immediately, add one very brief Chinese explanation, followed by a natural improved English version. Then continue the conversation.
- Do not correct every small error.
- Prefer natural, realistic Band-7-level language over rare or showy vocabulary.
- Never invent the learner's personal experiences.
- Keep replies concise enough for spoken conversation.
- If the learner says “结束今天的练习”, do not continue the conversation. The application will switch to review mode.`;
}

function reviewSystemPrompt(topic, mode) {
  return `Review the completed IELTS Speaking practice session below. The learner targets Band 7 and is preparing in Mainland China.

Topic: ${topic}
Mode: ${mode}

Base all advice on the IELTS Speaking criteria:
1. Fluency & Coherence
2. Lexical Resource
3. Grammatical Range & Accuracy
4. Pronunciation only if genuine voice evidence is actually available

Be concise and selective. Do NOT dump every mistake. Extract the highest-value learning points only.

Use these sections only when useful:
- Key Mistakes
- Better Expressions
- Useful Vocabulary & Collocations
- Reusable Stories
- Speaking Habits
- IELTS Transfer
- Session Gems
- Next Focus

Next Focus must contain only 1–2 highest-impact priorities. Do not force a numerical band score unless the session was exam-like enough to justify it. Do not save or reproduce the full transcript.`;
}

function isEndCommand(text) {
  return String(text || "")
    .trim()
    .replace(/[。.!！?？,，\s]+$/g, "") === "结束今天的练习";
}

function safeClose(socket, code = 1000, reason = "") {
  try {
    if (socket && socket.readyState < 2) socket.close(code, reason.slice(0, 120));
  } catch (_) {}
}

async function handleAsrWebSocket(request, env) {
  const origin = request.headers.get("Origin") || "";
  if (!isAllowedOrigin(origin)) return new Response("Forbidden", { status: 403 });
  if (!env.DASHSCOPE_API_KEY) return new Response("DASHSCOPE_API_KEY is missing", { status: 500 });

  const upgrade = request.headers.get("Upgrade");
  if (!upgrade || upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected Upgrade: websocket", { status: 426 });
  }

  const upstreamResponse = await fetch(DASHSCOPE_ASR_URL, {
    headers: {
      "Upgrade": "websocket",
      "Authorization": `Bearer ${env.DASHSCOPE_API_KEY}`,
      "User-Agent": "ielts-speaking-atlas/1.0"
    }
  });

  const upstream = upstreamResponse.webSocket;
  if (!upstream) {
    return new Response(`ASR upstream rejected WebSocket (${upstreamResponse.status})`, { status: 502 });
  }

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);

  server.accept({ allowHalfOpen: true });
  upstream.accept({ allowHalfOpen: true });
  server.binaryType = "arraybuffer";
  upstream.binaryType = "arraybuffer";

  server.addEventListener("message", event => {
    try {
      if (upstream.readyState === 1) upstream.send(event.data);
    } catch (_) {
      safeClose(server, 1011, "ASR upstream send failed");
    }
  });

  upstream.addEventListener("message", event => {
    try {
      if (server.readyState === 1) server.send(event.data);
    } catch (_) {
      safeClose(upstream, 1011, "Client send failed");
    }
  });

  server.addEventListener("close", event => {
    safeClose(upstream, event.code || 1000, event.reason || "client closed");
    safeClose(server, event.code || 1000, event.reason || "client closed");
  });

  upstream.addEventListener("close", event => {
    safeClose(server, event.code || 1000, event.reason || "ASR closed");
    safeClose(upstream, event.code || 1000, event.reason || "ASR closed");
  });

  server.addEventListener("error", () => {
    safeClose(upstream, 1011, "client socket error");
    safeClose(server, 1011, "client socket error");
  });

  upstream.addEventListener("error", () => {
    safeClose(server, 1011, "ASR socket error");
    safeClose(upstream, 1011, "ASR socket error");
  });

  return new Response(null, { status: 101, webSocket: client });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (url.pathname === "/api/asr") {
      return handleAsrWebSocket(request, env);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return json({
        ok: true,
        model: MODEL,
        asrModel: ASR_MODEL,
        asrConfigured: Boolean(env.DASHSCOPE_API_KEY)
      }, 200, origin);
    }

    if (url.pathname === "/api/session/start" && request.method === "POST") {
      try {
        const body = await request.json();
        const mode = body.mode === "voice" ? "voice" : "chat";
        const topic = selectTopic(parseTopicBank(env));
        const opening = await callGLM(env, [
          { role: "system", content: conversationSystemPrompt(topic, mode) },
          { role: "user", content: "Start today's session. First clearly state the IELTS topic in one short line, then begin with one natural conversational question." }
        ], 0.85);

        return json({
          sessionId: crypto.randomUUID(),
          topic,
          sourceLabel: "Recent Mainland China Speaking topic bank",
          opening
        }, 200, origin);
      } catch (error) {
        return json({ error: "SESSION_START_FAILED", detail: error.message }, 500, origin);
      }
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const body = await request.json();
        const mode = body.mode === "voice" ? "voice" : "chat";
        const topic = String(body.topic || "IELTS Speaking");
        const rawMessages = Array.isArray(body.messages) ? body.messages : [];
        const messages = rawMessages
          .filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
          .slice(-30)
          .map(m => ({ role: m.role, content: m.content.slice(0, 5000) }));

        const ended = messages.some(m => m.role === "user" && isEndCommand(m.content));
        const system = ended ? reviewSystemPrompt(topic, mode) : conversationSystemPrompt(topic, mode);
        const reply = await callGLM(env, [{ role: "system", content: system }, ...messages], ended ? 0.45 : 0.82);

        return json({ reply, recap: ended ? reply : null, ended }, 200, origin);
      } catch (error) {
        return json({ error: "CHAT_FAILED", detail: error.message }, 500, origin);
      }
    }

    return json({ error: "NOT_FOUND" }, 404, origin);
  }
};
