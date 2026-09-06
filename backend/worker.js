const ZHIPU_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const MODEL = "glm-4.7-flash";
const ASR_MODEL = "paraformer-realtime-v2";
const DASHSCOPE_ASR_URL = "https://dashscope.aliyuncs.com/api-ws/v1/inference";
const DEPLOYMENT_MARKER = "secrets-file-v2";
const GITHUB_REPO = "YuxuanYangECNU/ielts-english-knowledge-base";

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

function normaliseStoryBank(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => ({
      topic: String(item?.topic || "").slice(0, 120),
      story: String(item?.story || "").slice(0, 700)
    }))
    .filter(item => item.story)
    .slice(0, 10);
}

function storyContextBlock(storyBank) {
  const stories = normaliseStoryBank(storyBank);
  if (!stories.length) return "";
  return `\n\nOptional reusable stories remembered from earlier practice:\n${stories.map((item, index) => `${index + 1}. [${item.topic || "previous topic"}] ${item.story}`).join("\n")}\n\nUse these only when directly relevant. Never invent, embellish, or assume details that are not written here. Do not force an old story into the current topic; it is fine not to use any of them.`;
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

function conversationSystemPrompt(topic, mode, storyBank = []) {
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
- Every correction or suggested upgrade must sound idiomatic in real spoken English and must preserve the learner's intended meaning and register.
- A Band 7 answer does NOT require rare vocabulary. Prefer flexible, precise, common spoken collocations over inflated or showy wording.
- Judge improvements through IELTS Speaking priorities: Fluency & Coherence, Lexical Resource, and Grammatical Range & Accuracy; use pronunciation evidence only in genuine voice practice.
- Never invent the learner's personal experiences.
- Keep replies concise enough for spoken conversation.
- If the learner says “结束今天的练习”, do not continue the conversation. The application will switch to review mode.${storyContextBlock(storyBank)}`;
}

function reviewSystemPrompt(topic, mode) {
  return `你是 IELTS Speaking 复盘教练。请根据下面刚结束的练习，为目标 7 分的学习者做一次简洁、高价值的复盘。

Topic: ${topic}
Mode: ${mode}

评价依据必须是 IELTS Speaking 的真实方向：
- Fluency & Coherence：表达是否顺畅、展开是否自然、逻辑是否清楚；
- Lexical Resource：词汇是否灵活、准确、搭配自然，而不是是否“高级”；
- Grammatical Range & Accuracy：句型范围与准确度；
- Pronunciation：只有语音练习且确实存在可判断的发音证据时才评价。

必须遵守：
- 最终复盘以中文为主；需要保留和示范的英文句子、词组、搭配保持英文。
- 所有英文优化都必须先通过“母语者自然度”检查：真实口语里地道、常用、语域合适，并保留原意。
- 不要为了显得高级而把简单自然的表达换成生僻或书面词。比如一般语境下，spend time on my hobbies / do things I enjoy 往往比 indulge in my hobbies 更自然。
- 只挑真正影响自然度、准确度、展开能力或 IELTS 表现的问题，不要把所有小错误都列出来。
- 不要把普通打字拼写错误当成口语能力问题，除非它明显反映词汇掌握问题。
- 错误分类必须准确。例如不自然搭配不要误标成主谓一致错误。
- “IELTS 迁移”要指出本次内容还能支持哪些 Part 1 / Part 2 / Part 3 题型或话题，不要在那里重复评分标准。
- 如果本次对话出现真实、可复用的个人经历，提炼成“可复用故事”：用 1–2 句概括真实素材，再标出可迁移的话题；绝不补写用户没有说过的情节。
- 如果没有真正可复用的故事，就省略“可复用故事”。
- 不要强行给分，除非本次对话足够接近正式 mock。
- 不要复述完整聊天记录。
- 总长度控制在大约 300–500 个中文字以内，宁缺毋滥。

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
- “关键问题”优先标清问题类型，例如【搭配】【语法】【展开】【连贯】。
- “更自然的表达”优先用：原表达 → 更自然表达；必要时补一小句中文说明。
- “可复用故事”尽量写成：真实素材 + 可用于哪些 IELTS 话题。
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

function chinaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function slugify(value) {
  return String(value || "ielts-speaking")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "ielts-speaking";
}

function utf8ToBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function stripPrivateStorySection(recap) {
  const lines = String(recap || "").split(/\r?\n/);
  const output = [];
  let skipping = false;
  for (const line of lines) {
    if (/^###\s+(?:可复用故事|Reusable Stories)\s*$/i.test(line.trim())) {
      skipping = true;
      continue;
    }
    if (skipping && /^###\s+/.test(line.trim())) skipping = false;
    if (!skipping) output.push(line);
  }
  return output.join("\n").trim();
}

async function syncRecapToGitHub(env, { sessionId, topic, mode, recap }) {
  if (!env.GITHUB_RECAP_TOKEN) {
    return { ok: false, skipped: true, code: "GITHUB_RECAP_TOKEN_MISSING" };
  }

  const date = chinaDate();
  const folder = mode === "voice"
    ? "knowledge/speaking/practice/practice-accumulation/voice"
    : "knowledge/speaking/practice/practice-accumulation/chat";
  const shortId = String(sessionId || crypto.randomUUID()).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase();
  const filename = `${date}-${slugify(topic)}-${shortId}.md`;
  const path = `${folder}/${filename}`;
  const meta = JSON.stringify({ date, topic, mode, sessionId: sessionId || null });
  const publicRecap = stripPrivateStorySection(recap);
  const markdown = `<!-- IELTS_RECAP_META ${meta} -->\n\n# ${date} · ${topic}\n\n**Mode:** ${mode === "voice" ? "Voice" : "Chat"}\n\n${publicRecap}\n`;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${encodedPath}`, {
    method: "PUT",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${env.GITHUB_RECAP_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ielts-speaking-atlas/1.0",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: `Save ${mode} Speaking recap: ${date} ${topic}`,
      content: utf8ToBase64(markdown)
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    return { ok: false, skipped: false, code: `GITHUB_${response.status}`, detail: detail.slice(0, 220) };
  }

  const data = await response.json();
  return {
    ok: true,
    skipped: false,
    path,
    htmlUrl: data?.content?.html_url || null
  };
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
        asrConfigured: Boolean(env.DASHSCOPE_API_KEY),
        githubRecapSyncConfigured: Boolean(env.GITHUB_RECAP_TOKEN)
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
        const storyBank = normaliseStoryBank(body.storyBank);
        const opening = await callGLM(env, [
          { role: "system", content: conversationSystemPrompt(topic, mode, storyBank) },
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
        const storyBank = normaliseStoryBank(body.storyBank);
        const rawMessages = Array.isArray(body.messages) ? body.messages : [];
        const messages = rawMessages
          .filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
          .slice(-30)
          .map(m => ({ role: m.role, content: m.content.slice(0, 5000) }));

        const ended = messages.some(m => m.role === "user" && isEndCommand(m.content));
        const system = ended ? reviewSystemPrompt(topic, mode) : conversationSystemPrompt(topic, mode, storyBank);
        const reply = await callGLM(env, [{ role: "system", content: system }, ...messages], ended ? 0.35 : 0.82);

        let recapSync = null;
        if (ended && reply) {
          try {
            recapSync = await syncRecapToGitHub(env, {
              sessionId: body.sessionId,
              topic,
              mode,
              recap: reply
            });
          } catch (syncError) {
            recapSync = { ok: false, skipped: false, code: "GITHUB_SYNC_ERROR", detail: String(syncError?.message || syncError).slice(0, 220) };
          }
        }

        return json({ reply, recap: ended ? reply : null, ended, recapSync }, 200, origin);
      } catch (error) {
        return json({ error: "CHAT_FAILED", detail: error.message }, 500, origin);
      }
    }

    return json({ error: "NOT_FOUND" }, 404, origin);
  }
};
