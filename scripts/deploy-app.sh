#!/usr/bin/env bash
# deploy-app.sh — deploy the Node/Express web app to gil-vm production.
#
# Ships the repo + app to /opt/dreaming-press, installs runtime deps + builds
# the SQLite DB on the server, swaps the systemd service to the Node app, and
# reconfigures nginx to proxy everything to it.
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${DP_HOST:-root@gil-vm}"
DEST="${DP_DEST:-/opt/dreaming-press}"

echo "▸ Local prep: ingest + covers…"
( cd app && node scripts/ingest.js && node scripts/gen-art.js )

echo "▸ Rsync repo → ${HOST}:${DEST} …"
rsync -az \
  --exclude '.git' --exclude '**/node_modules' --exclude '.gstack' \
  --exclude '__pycache__' --exclude '**/__pycache__' --exclude '*.bak' --exclude '*.bak2' \
  --exclude '.ralphy' --exclude '.DS_Store' --exclude 'logs' --exclude 'tts/.venv' \
  --exclude 'tts/*.onnx' --exclude 'tts/*.bin' --exclude 'app/data/*.db-wal' --exclude 'app/data/*.db-shm' \
  ./ "${HOST}:${DEST}/"

echo "▸ Server: install runtime deps, build DB, install service…"
ssh "$HOST" bash -se <<'REMOTE'
set -euo pipefail
cd /opt/dreaming-press/app
npm install --omit=dev --no-audit --no-fund
node scripts/ingest.js
install -m 644 deploy/dreaming-press.service /etc/systemd/system/dreaming-press.service
systemctl daemon-reload
systemctl enable dreaming-press >/dev/null 2>&1 || true
systemctl restart dreaming-press
sleep 2
curl -fsS http://127.0.0.1:3003/healthz && echo " <- app healthy"
REMOTE

echo "▸ Server: point nginx at the app (proxy all)…"
ssh "$HOST" bash -se <<'REMOTE'
set -euo pipefail
CONF=/etc/nginx/sites-enabled/dreaming-press
cp "$CONF" /tmp/dreaming-press.nginx.bak.$(date +%s)
# replace the `location / { ... }` block with a proxy to the app
python3 - "$CONF" <<'PY'
import re,sys
f=sys.argv[1]; s=open(f).read()
proxy='''location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }'''
s=re.sub(r'location / \{.*?\n    \}', proxy, s, count=1, flags=re.S)
open(f,'w').write(s)
print("nginx location / -> proxy")
PY
nginx -t && systemctl reload nginx && echo "nginx reloaded"
REMOTE

echo "✓ Deployed app. https://dreaming.press/"
