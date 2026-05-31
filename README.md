# SocialBoost

AI-powered social media content generator. Produces platform-tailored posts, A/B variants, video scripts, video ads, and carousels for LinkedIn, Facebook, Instagram, Pinterest, and X/Twitter — and renders the videos.

[**Live:** socialboost-green.vercel.app](https://socialboost-green.vercel.app) (status note: see `SUPABASE-RESTORE.md` if the live deploy is in a bad state)

## What it does

- **Multi-platform post generation** — gpt-4o-mini behind sharpened prompts that ban AI-tell phrases and target the engagement-sweet-spot length per platform
- **Auto-train brand voice** — analyzes a user's existing posts and extracts a structured voice profile that's injected into every future generation. Stops the "all my posts sound like ChatGPT" problem (Pro)
- **A/B variants** — three distinct angles on the same topic in one call
- **Video pipeline** — video scripts with hooks, scenes, narration, CTAs → AI-generated portrait images per scene + OpenAI TTS voiceover → ffmpeg-rendered MP4 with Ken-Burns zoom + text overlays (Pro)
- **Carousels** — multi-slide LinkedIn/Instagram content
- **Image generation** — gpt-image-1, persisted to Supabase Storage
- **Series cron** — recurring content generation on a schedule
- **History, calendar, drag-to-schedule** — content lifecycle management
- **Real publishing** — OAuth into LinkedIn / Facebook / Instagram / Pinterest / X, cron pushes scheduled posts to the platforms
- **Analytics events table** — every generation, save, schedule, and publish is logged to `analytics_events` for queryable feature-adoption data
- **Stripe billing** — Free (10 generations/month) and Pro ($9/month, 100 generations/month) with webhooks + customer portal
- **Bilingual UI** (EN/DE) via the in-house `useLanguage()` provider

## Tech stack

- **Framework:** Next.js 16 (App Router, Turbopack, Server Components)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4, shadcn/ui (Radix)
- **Auth & DB:** Supabase (Postgres, Auth, RLS, Storage)
- **AI:** OpenAI — `gpt-4o-mini` for text, `gpt-image-1` for images, `gpt-4o-mini-tts` for voice
- **Payments:** Stripe
- **Video render worker:** Express + ffmpeg, deployable to Railway / Fly / Hetzner (see `worker/README.md`)
- **Deployment:** Vercel
- **Testing:** Vitest + Testing Library (665+ tests, MSW-style mocks for OpenAI and Supabase)

## Project layout

```
src/
  app/
    (auth)/                  # login, signup, forgot/reset password
    (dashboard)/             # dashboard, create, history, calendar, analytics, accounts, series, repurpose, templates, review, team, settings
    api/
      generate/              # post generation
      generate-image/        # gpt-image-1
      generate-variants/     # A/B
      generate-video-*/      # script / ad / from-site / assets / voiceover
      generate-carousel/
      brand-voice/analyze/   # Phase 2 auto-trainer
      render-video/          # proxies to the worker
      score/                 # deterministic 0-100 content scorer
      cron/                  # generate-series, publish
      stripe/                # checkout + webhook + portal
      track/                 # client-side analytics events
      v1/                    # public API (Bearer-token auth)
  components/                # UI + composite components
  lib/
    openai.ts                # all generation + analysis functions
    openai-tts.ts            # voice synthesis
    content-score.ts         # shared scorer used by /api/score and series-runner
    analytics.ts             # trackEvent → console.log + analytics_events insert
    track-client.ts          # fire-and-forget client-side tracking
    audit-log.ts             # action audit trail
    series-runner.ts         # cron-driven content series
    supabase/                # client / server / middleware
    platforms/               # platform publishers (LinkedIn, FB, IG, Pinterest, X)
supabase/
  schema.sql                 # base schema with RLS
  migration-*.sql            # individual migrations, idempotent, applied in order
  config.toml                # local dev ports (553xx range)
worker/                      # standalone video render service (Express + ffmpeg)
```

## Local development

### One-time setup

```bash
git clone https://github.com/Webmsaster/socialboost.git
cd socialboost
npm install
```

### Local Supabase stack (avoids paying for hosted dev)

```bash
supabase start
# Apply schema and all migrations:
PGPASSWORD=postgres psql -h 127.0.0.1 -p 55322 -U postgres -d postgres \
  -f supabase/schema.sql \
  -f supabase/migration-v2.sql \
  -f supabase/migration-perf-indexes.sql \
  -f supabase/migration-website-series.sql \
  -f supabase/migration-add-full-name.sql \
  -f supabase/migration-newsletter.sql \
  -f supabase/migration-2026-04-11.sql \
  -f supabase/schema-templates.sql \
  -f supabase/storage-migration.sql \
  -f supabase/migration-audit-log.sql \
  -f supabase/migration-analytics-events.sql \
  -f supabase/PENDING-APPLY-ON-LIVE.sql
```

Copy `.env.example` to `.env.local` and set the values to point at your local Supabase (`http://127.0.0.1:55321`) and the demo keys printed by `supabase status -o env`.

### Run

```bash
npm run dev          # Next.js dev server on :3000
# In another terminal, if you want to render videos:
cd worker && cp .env.example .env && npm install && npm run dev
```

## Key commands

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server with Turbopack |
| `npm run build` | Production build |
| `npm test` | Vitest test suite |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | TypeScript check (no emit) |

## Deployment

- **Frontend:** Vercel auto-deploys `main`. Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `RESEND_API_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`. Optional: `VIDEO_RENDER_URL` + `VIDEO_RENDER_TOKEN` (point at the deployed worker).
- **Video worker:** see `worker/README.md`. One-click Railway deploy from the same repo, Root Directory `worker`.
- **Supabase down?** See `SUPABASE-RESTORE.md` for the 10-minute restore playbook.

## Design notes

- **RLS everywhere.** Every table has Row-Level Security on. Service-role is server-only (`SUPABASE_SERVICE_ROLE_KEY`).
- **AI prompt strategy.** See `STYLE_GUARDS` in `src/lib/openai.ts` — an explicit ban-list of 25+ overused AI phrases ("leverage", "harness", "elevate", …), platform-specific length targets matched to `content-score.ts` ideal values.
- **Brand voice flows through everywhere.** `profiles.brand_voice` is read by every generation route. Phase 2 auto-trainer (Settings → Auto-train brand voice) writes a serialized profile in there; manual textarea still works as the fallback.
- **Content score is shared.** Both `/api/score` (live UI feedback) and `series-runner` (cron-saved posts) call `scoreContent()` from `src/lib/content-score.ts` so the column has the same meaning everywhere.
- **Image gen:** `gpt-image-1` returns base64 — `persistImage()` accepts both `http` URLs and `data:` URLs, decodes either to a Supabase Storage upload.
- **Video render:** the worker takes scene images + voiceover (data-URL or http), generates Ken-Burns clips with `zoompan d=frames` (single-frame input — `-loop 1` multiplies frames exponentially), concats them, overlays voiceover, returns a public URL.

## Status

| | |
|---|---|
| Tests | 665+ passing |
| Build | clean |
| Lint | 0 errors |
