# SocialBoost Video Worker

Render Ken-Burns slideshow MP4s from per-scene images + a voiceover. Designed to be deployed alongside the main SocialBoost app, on Railway, Fly.io, Render, or a small VPS.

## Endpoints

- `GET /health` — heartbeat, returns `{ ok: true }`.
- `POST /render` — auth required. Body:
  ```jsonc
  {
    "userId": "supabase-user-uuid",
    "aspect": "9:16",           // or "16:9", "1:1"
    "scenes": [
      { "imageUrl": "https://...", "duration": 5, "textOverlay": "Hook copy" },
      ...
    ],
    "voiceoverDataUrl": "data:audio/mpeg;base64,...",  // or an http(s) URL
    "brandName": "SocialBoost"
  }
  ```
  Header `Authorization: Bearer $RENDER_API_TOKEN`. Response: `{ "videoUrl": "https://.../generated-videos/.../video.mp4" }`.

## Env vars (`.env.example`)

| Name | Purpose |
|---|---|
| `RENDER_API_TOKEN` | Shared secret; the main app sends it as `Authorization: Bearer ...` |
| `SUPABASE_URL` | Project URL — same Supabase the main app uses |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (server-only) used to upload videos |
| `SUPABASE_VIDEO_BUCKET` | Bucket name, default `generated-videos` |
| `PORT` | Set automatically by Railway/Render |

## Local dev

```bash
cp .env.example .env
npm install
npm run dev
# in another shell, hit it:
curl -X POST http://localhost:8080/render \
  -H "Authorization: Bearer $RENDER_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d @example-payload.json
```

Requires `ffmpeg` on PATH locally (`apt install ffmpeg` / `brew install ffmpeg`).

## Deploying to Railway free trial

1. Push this repo to GitHub if you haven't already.
2. In Railway, click **New Project → Deploy from GitHub repo**, pick this repo, and set the **Root Directory** to `worker`.
3. Railway auto-detects the Dockerfile. Set the env vars from `.env.example` in the Variables tab.
4. Once deployed, copy the public URL Railway gives you and set `VIDEO_RENDER_URL` + `VIDEO_RENDER_TOKEN` in the main app.

## Cost

Free Railway trial gives ~$5 of credits/month. A 30-sec 1080×1920 render uses ~1 CPU-minute and ~300MB RAM peak, costing roughly $0.005 per video. ~1000 videos before you hit the credit cap.

Alternatives at similar cost: **Fly.io** (free tier with shared-cpu VMs), **Render.com** (free web service, cold-starts on idle), **Hetzner Cloud** (€4/month flat, unlimited).
