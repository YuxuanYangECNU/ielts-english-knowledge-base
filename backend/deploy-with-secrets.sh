#!/bin/sh
set -eu

# Cloudflare Workers Builds exposes Build Secrets as environment variables only
# during the build/deploy process. Convert the two API keys into a temporary
# secrets file so Wrangler uploads them as encrypted Worker runtime secrets.

if [ -z "${ZHIPU_API_KEY:-}" ]; then
  echo "Missing Cloudflare Build Secret: ZHIPU_API_KEY" >&2
  exit 1
fi

if [ -z "${DASHSCOPE_API_KEY:-}" ]; then
  echo "Missing Cloudflare Build Secret: DASHSCOPE_API_KEY" >&2
  exit 1
fi

SECRETS_FILE="$(mktemp)"
trap 'rm -f "$SECRETS_FILE"' EXIT HUP INT TERM

node -e '
  const fs = require("fs");
  const target = process.argv[1];
  fs.writeFileSync(target, JSON.stringify({
    ZHIPU_API_KEY: process.env.ZHIPU_API_KEY,
    DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY
  }));
' "$SECRETS_FILE"

npx wrangler deploy --secrets-file "$SECRETS_FILE"
