#!/bin/sh
set -eu

# Cloudflare Workers Builds exposes Build Secrets only during build/deploy.
# Convert them into a temporary secrets file so Wrangler uploads them as
# encrypted Worker runtime secrets.

if [ -z "${ZHIPU_API_KEY:-}" ]; then
  echo "ERROR: Missing Cloudflare Build Secret: ZHIPU_API_KEY" >&2
  exit 1
fi

if [ -z "${DASHSCOPE_API_KEY:-}" ]; then
  echo "ERROR: Missing Cloudflare Build Secret: DASHSCOPE_API_KEY" >&2
  exit 1
fi

if [ -n "${GITHUB_RECAP_TOKEN:-}" ]; then
  echo "Build secrets detected: ZHIPU_API_KEY=yes, DASHSCOPE_API_KEY=yes, GITHUB_RECAP_TOKEN=yes"
else
  echo "Build secrets detected: ZHIPU_API_KEY=yes, DASHSCOPE_API_KEY=yes, GITHUB_RECAP_TOKEN=no (GitHub recap sync disabled)"
fi

echo "Deploying Worker with runtime secrets via --secrets-file..."

SECRETS_FILE="$(mktemp)"
trap 'rm -f "$SECRETS_FILE"' EXIT HUP INT TERM

node -e '
  const fs = require("fs");
  const target = process.argv[1];
  const secrets = {
    ZHIPU_API_KEY: process.env.ZHIPU_API_KEY,
    DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY
  };
  if (process.env.GITHUB_RECAP_TOKEN) secrets.GITHUB_RECAP_TOKEN = process.env.GITHUB_RECAP_TOKEN;
  fs.writeFileSync(target, JSON.stringify(secrets));
' "$SECRETS_FILE"

npx wrangler deploy --secrets-file "$SECRETS_FILE"

echo "Worker deploy completed with runtime secrets."
