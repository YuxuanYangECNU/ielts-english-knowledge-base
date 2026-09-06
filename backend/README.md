# Speaking API backend

Cloudflare Worker backend for the website's **Free Chat** and **Free Voice** routes.

## Current providers

- LLM: `glm-4.7-flash` via Zhipu BigModel.
- Realtime ASR: `paraformer-realtime-v2` via Alibaba Cloud Model Studio / DashScope.
- TTS: browser `SpeechSynthesis`, default language `en-GB`.

## Security

Never commit API keys to GitHub or expose them in browser JavaScript.

Required Cloudflare Worker secrets:

```text
ZHIPU_API_KEY
DASHSCOPE_API_KEY
```

The browser never receives either key. Realtime ASR connects through the Worker WebSocket proxy.

## Endpoints

- `GET /health`
- `POST /api/session/start`
- `POST /api/chat`
- `WS /api/asr` — authenticated proxy to DashScope Paraformer realtime ASR

The frontend API URL is configured in:

```text
web/javascripts/speaking-config.js
```

## Free Voice chain

```text
Browser microphone
  → PCM mono audio
  → Cloudflare Worker WebSocket proxy
  → paraformer-realtime-v2
  → transcript
  → GLM-4.7-Flash
  → browser British-English TTS
```

The microphone request asks the browser to enable echo cancellation, noise suppression and automatic gain control. The microphone remains active while the coach speaks so the learner can interrupt; the frontend also filters likely TTS echo before treating it as a new learner turn.

## Topic bank

For the zero-cost route, the Worker currently reads `IELTS_TOPIC_BANK` from Worker environment variables instead of paying for web search on every session.

The topic bank should be refreshed from recent Mainland China IELTS Speaking recall sources. The exact update automation will be added separately.

## Remaining integration

- session recap → GitHub automatic create/edit/delete;
- progress tracker → future topic selection;
- regular refresh of the Mainland China recent-topic bank;
- optional cloud TTS fallback if browser voices are unsatisfactory.
