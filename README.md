# skifree-web

Browser homage to the classic SkiFree. Vanilla HTML/Canvas/JS, no build step.

## Run locally
```
python3 -m http.server 8000
# open http://localhost:8000
```

## Controls
- **Desktop**: Arrow keys / WASD. Down to dive. Space to start/restart.
- **Mobile**: on-screen ◀ ▼ ▶ buttons (auto-shown on touch devices).

Auto-detects which UI to show; both input paths stay live.

## Deploy
```
./deploy.sh
```
Rsyncs to `/var/www/skifree-web` on the brain EC2. Nginx config in `infra/`.
