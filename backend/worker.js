const ZHIPU_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const MODEL = "glm-4.7-flash";
const ASR_MODEL = "paraformer-realtime-v2";
const DASHSCOPE_ASR_URL = "https://dashscope.aliyuncs.com/api-ws/v1/inference";
const DEPLOYMENT_MARKER = "secrets-file-v2";

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
  return `你是 IELTS Speaking 复盘教练。请根据下面刚结束的练习，为目标 7 分的学习者做一次简洁、高价值的复盘。

Topic: ${topic}
Mode: ${mode}

必须遵守：
- 最终复盘以中文为主；需要保留和示范的英文句子、词组、搭配保持英文。
- 只挑真正影响自然度、准确度或 IELTS 表现的问题，不要把所有小错误都列出来。
- 不要把普通打字拼写错误当成口语能力问题，除非它明显反映词汇掌握问题。
- 错误分类必须准确。例如不自然搭配不要误标成主谓一致错误。
- “IELTS 迁移”应该说明本次内容还能迁移到哪些 Part 1 / Part 2 / Part 3 题型或话题，不要在那里重复四项评分标准。
- 口语模式下只有确实有发音证据时才评价 Pronunciation；文字聊天不要评价发音。
- 不要强行给分，除非本次对话足够接近正式 mock。
- 不要复述完整聊天记录。
- 总长度控制在大约 250–450 个中文字以内，宁缺毋滥。

请只使用下面这些中文标题；没有内容价值的部分直接省略：
### 关键问题
### 更自然的表达
### 有用词汇与搭配
### 可复用故事
### 口语习惯
### IELTS 迁移
### 本次亮点
### 下次重点

格式要求：
- 每个部分最多 2–4 条。
- “更自然的表达”优先用：原表达 → 更自然表达；必要时补一小句中文说明。
- “下次重点”只保留 1–2 个最值得改的点。
- 不要输出英文版标题，不要输出表格，不要输出多余开场白或结尾客套话。`;
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

async function checkAsrUpstream(env) {
  if (!env.DASHSCOPE_API_KEY) {
    return { ok: false, status: 500, code: "ASR_SECRET_MISSING", detail: "DASHSCOPE_API_KEY is missing" };
  }

  try {
    const response = await fetch(DASHSCOPE_ASR_URL, {
      headers: {
        "Upgrade": "websocket",
        "Authorization": `Bearer ${env.DASHSCOPE_API_KEY}`,
        "User-Agent": "ielts-speaking-atlas/1.0"
      }
    });

    const socket = response.webSocket;
    if (!socket) {
      let detail = "";
      try { detail = await response.text(); } catch (_) {}
      return {
        ok: false,
        status: response.status || 502,
        code: "ASR_HANDSHAKE_REJECTED",
        detail: detail.slice(0, 240)
      };
    }

    socket.accept();
    safeClose(socket, 1000, "preflight");
    return { ok: true, status: 200, code: "ASR_READY" };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      code: "ASR_UPSTREAM_ERROR",
      detail: String(error?.message || error).slice(0, 240)
    };
  }
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
        deployment: DEPLOYMENT_MARKER,
        model: MODEL,
        llmConfigured: Boolean(env.ZHIPU_API_KEY),
        asrModel: ASR_MODEL,
        asrConfigured: Boolean(env.DASHSCOPE_API_KEY)
      }, 200, origin);
    }

    if (url.pathname === "/api/asr/check" && request.method === "GET") {
      if (!isAllowedOrigin(origin)) return json({ ok: false, code: "FORBIDDEN" }, 403, origin);
      const result = await checkAsrUpstream(env);
      return json({
        ok: result.ok,
        code: result.code,
        detail: result.detail || null,
        asrModel: ASR_MODEL
      }, result.ok ? 200 : result.status, origin);
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
        const reply = await callGLM(env, [{ role: "system", content: system }, ...messages], ended ? 0.35 : 0.82);

        return json({ reply, recap: ended ? reply : null, ended }, 200, origin);
      } catch (error) {
        return json({ error: "CHAT_FAILED", detail: error.message }, 500, origin);
      }
    }

    return json({ error: "NOT_FOUND" }, 404, origin);
  }
};
