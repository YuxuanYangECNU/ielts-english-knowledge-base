# Speaking API backend

Cloudflare Worker backend for the website's **Free Chat** route and the shared LLM layer used later by **Free Voice**.

## Current provider

- LLM: `glm-4.7-flash`
- Provider: Zhipu BigModel
- API key is stored only as a Cloudflare Worker secret.

## Security

Never commit API keys to GitHub or expose them in browser JavaScript.

Required secret:

```text
ZHIPU_API_KEY
```

## Endpoints

- `GET /health`
- `POST /api/session/start`
- `POST /api/chat`

The frontend API URL is configured in:

```text
web/javascripts/speaking-config.js
```

## Topic bank

For the zero-cost route, the Worker currently reads `IELTS_TOPIC_BANK` from Worker environment variables instead of paying for web search on every session.

The topic bank should be refreshed from recent Mainland China IELTS Speaking recall sources. The exact update automation will be added separately.

## Next integration

1. Deploy the Worker.
2. Add `ZHIPU_API_KEY` as a Worker secret.
3. Put the Worker URL into `speaking-config.js`.
4. Add realtime ASR for Free Voice.
5. Add session recap → GitHub automatic write/edit/delete.
