# Speaking API backend

Cloudflare Worker backend for the website's **Free Chat** and **Free Voice** routes.

## Current providers

- LLM: `glm-4.7-flash` via Zhipu BigModel.
- Realtime ASR: `paraformer-realtime-v2` via Alibaba Cloud Model Studio / DashScope.
- TTS: browser `SpeechSynthesis`, default language `en-GB`.

## Security

Never commit API keys to GitHub or expose them in browser JavaScript.

Required Worker runtime secrets:

```text
ZHIPU_API_KEY
DASHSCOPE_API_KEY
```

The browser never receives either key. Realtime ASR connects through the Worker WebSocket proxy.

## Cloudflare deployment

This repository is connected to Cloudflare Workers Builds. The two API keys are stored there as **Build Secrets** and are available only during deployment.

Use this deploy command in Cloudflare:

```text
cd backend && sh deploy-with-secrets.sh
```

`deploy-with-secrets.sh` reads the two Build Secrets, writes them only to a temporary JSON file inside the build environment, and runs:

```text
npx wrangler deploy --secrets-file <temporary-file>
```

Wrangler then uploads them as encrypted **Worker runtime secrets** together with the Worker code. The temporary file is deleted automatically after deployment and is never committed to GitHub.

After deployment, verify:

```text
GET /health
```

Expected configuration state:

```json
{
  "llmConfigured": true,
  "asrConfigured": true
}
```

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
