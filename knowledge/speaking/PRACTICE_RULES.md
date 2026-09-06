[← Speaking hub](README.md) · [Authoring rules](../../AUTHORING_RULES.md)

# Speaking Practice Rules · 口语实战规则

> This file is the source of truth for the **Speaking → Practice** area. Read it before changing the Speaking practice pages, session workflow, or practice accumulation.

## 1 · Speaking architecture · 页面层级

The conceptual website structure is:

```text
Speaking
├── Accumulation
│   └── Topic pages added only when actually studied
│       └── e.g. People & Relationships
│
└── Practice
    ├── Voice
    │   ├── ChatGPT Voice
    │   └── Free Voice
    ├── Chat
    │   └── Free Chat only
    └── Practice Accumulation
        ├── Voice Accumulation
        └── Chat Accumulation
```

Important distinctions:

- **Accumulation** and **Practice** are parallel top-level areas under Speaking.
- `People & Relationships` is only one learned topic inside **Accumulation**, not a permanent structural category.
- Do **not** pre-create a complete IELTS topic taxonomy. Add a topic page only when the user actually studies that topic.
- Material generated from Practice must **not** be merged automatically into the main Accumulation area.
- `Chat` has only the free-model route; do not add a separate ChatGPT Chat branch unless the user later requests it.

## 2 · Practice purpose · 实战目标

Practice should feel like genuine conversation while quietly serving IELTS Speaking improvement.

The priorities are:

1. natural spoken output;
2. recent IELTS Speaking topic relevance;
3. Band-7-oriented correction and language improvement;
4. reusable personal stories, vocabulary and expressions;
5. concise feedback that identifies the few changes with the highest impact.

Do not turn normal practice into a rigid examiner script unless the user explicitly asks for a mock test.

## 3 · Topic selection · 选题规则

Each practice session uses **one main topic only**.

Before a new session:

- check the **latest Mainland China IELTS Speaking question-bank information online**;
- treat online question banks as candidate / recalled questions rather than official IELTS releases;
- prefer topics that appear repeatedly across credible recent sources;
- prioritise recent new questions, high-frequency questions, unpractised topics and weak topics;
- avoid unnecessary short-term repetition;
- combine the selected IELTS topic with the user's genuine experiences and interests so the conversation remains natural.

At the beginning, tell the user clearly which IELTS topic is being practised. Do not hide the topic.

A compact opening is preferred, for example:

> **Today's IELTS topic:** Technology  
> **Source:** Recent Mainland China Speaking question bank

Then transition into normal conversation rather than immediately firing a list of exam questions.

## 4 · Conversation behaviour · 聊天规则

Default conversation language: **English**.

During the session:

- let the user finish the current turn before correcting anything;
- do not interrupt mid-answer for language correction;
- correct only a clearly important mistake when immediate feedback has high learning value;
- give the brief correction / explanation in **Chinese** and the improved expression in **English**;
- keep minor issues for the final review so fluency is not repeatedly broken;
- use natural follow-up questions to deepen the same topic;
- allow Part 1 / Part 2 / Part 3 ideas to emerge naturally instead of mechanically reproducing an exam interview;
- do not impose a fixed session length.

The session ends only when the user says:

> **结束今天的练习**

## 5 · ChatGPT Voice route · ChatGPT 语音入口

This route lives under:

`Speaking → Practice → Voice → ChatGPT Voice`

Use a dedicated ChatGPT Project for speaking sessions so each session stays grouped with the same instructions and reference material.

Preferred workflow:

1. In normal ChatGPT chat, use **GPT-5.6 Sol · Instant** for the session setup, web-based topic selection, transcript review and structured recap.
2. Start ChatGPT Voice for the live spoken conversation.
3. After the voice session ends, use the conversation transcript in the same chat for the final review and GitHub sync.

Important model note:

- ChatGPT Voice itself uses ChatGPT's **Live voice model**, which is separate from the selected text model.
- Therefore, `GPT-5.6 Sol · Instant` is the preferred **text/review model**, not the underlying live voice model.
- Do not use GPT-6 for this workflow unless the user explicitly changes this preference.
- Do not use Work; use ordinary ChatGPT chat / voice inside the dedicated project.

## 6 · Free Voice and Free Chat · 免费入口

`Free Voice` and `Chat` should share the **same domestic / free large-model backend** and the same IELTS topic-selection, progress and feedback logic.

- **Free Voice:** microphone → speech recognition → free domestic LLM → speech synthesis.
- **Free Chat:** the same LLM backend, text interface only.
- Target both **iPhone Safari** and **Android Chrome**.
- Prioritise long-term zero-cost or genuinely usable free-tier components over premium real-time voice quality.
- The exact domestic API / ASR / TTS provider is not fixed yet; do not hard-code a provider into the architecture until evaluated.

## 7 · IELTS-based review · 结束后的复盘

When the user says **“结束今天的练习”**, review the whole session.

All recommendations must be grounded in the IELTS Speaking assessment criteria:

- **Fluency & Coherence**
- **Lexical Resource**
- **Grammatical Range & Accuracy**
- **Pronunciation** — only when the session is genuinely voice-based and pronunciation evidence is available

The review should be concise, selective and high-impact. It is not an error dump.

### Session header

Show only:

`Date · Topic · Mode · Main issue`

### Keep these sections when useful

1. **Key Mistakes** — only repeated, high-impact or meaning-affecting errors.
2. **Better Expressions** — user's wording → natural Band-7-oriented wording that the user can realistically say.
3. **Useful Vocabulary & Collocations** — small number of genuinely reusable items.
4. **Reusable Stories** — real experiences from the conversation that could support other IELTS questions.
5. **Speaking Habits** — recurring habits such as overusing `I think`, `because`, `very`, weak development, translation-like phrasing, excessive fillers or fragmented answers.
6. **IELTS Transfer** — which recent Part 1 / 2 / 3 questions the session's ideas can support.
7. **Session Gems** — usually 2–4 especially useful sentences / expressions worth retaining.
8. **Next Focus** — only the 1–2 changes with the highest expected impact on the next session.

Do not add sections merely to fill a template. If there is little useful content, keep the review short.

### Scoring policy

- Do **not** force a numerical band estimate onto every casual conversation.
- For normal practice, identify what currently helps or limits performance under the four IELTS criteria.
- Give a band estimate only for a sufficiently exam-like Part 1 / 2 / 3 mock or when the user explicitly asks for one.

## 8 · Progress tracking · 长期进度

Maintain a lightweight Speaking Progress Tracker containing at least:

- practised topic;
- date;
- Voice or Chat mode;
- major recurring weakness;
- useful reusable story / expression signals;
- whether the topic should be revisited.

Use this tracker for future topic selection:

- reduce unnecessary repetition;
- prioritise unpractised areas;
- deliberately revisit weak areas later;
- notice recurring IELTS-criterion bottlenecks over multiple sessions.

## 9 · Practice Accumulation · 实战积累

Practice Accumulation is separate from the main Speaking Accumulation.

Structure:

```text
Practice Accumulation
├── Voice Accumulation
└── Chat Accumulation
```

Rules:

- save **each session separately**;
- do not split Voice Accumulation by `ChatGPT Voice` vs `Free Voice`;
- do not save the raw full transcript to GitHub;
- save only the compact high-value review material;
- Voice and Chat accumulation stay separate;
- each session page should be editable and deletable from the website;
- website edits must update the corresponding GitHub source file;
- website deletion must delete the corresponding GitHub source file;
- after a completed session review, sync the new session entry to GitHub automatically when the connected workflow permits it.

Recommended filename pattern:

```text
YYYY-MM-DD-topic-slug.md
```

If multiple sessions share the same date and topic, append a short numeric suffix.

## 10 · Storage principle · 保存原则

**Keep learning value, not conversation volume.**

Never save a full chat merely because it happened. The saved session should make it obvious:

- what IELTS-relevant language improved;
- what is still limiting performance;
- what can be reused next time;
- what should be practised next.

This file should be updated whenever the user changes the Speaking Practice architecture or workflow, so future conversations can manage this area consistently.
