# SocialBoost

## Project Overview
SaaS web app that generates AI-powered social media posts for multiple platforms (LinkedIn, Facebook, Instagram, Pinterest, Twitter/X).

## Tech Stack
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4, shadcn/ui components
- **Auth & DB:** Supabase (PostgreSQL, Auth, RLS)
- **AI:** OpenAI API — gpt-4o-mini (text), gpt-image-1 (images), gpt-4o-mini-tts (voiceover)
- **Payments:** Stripe (Checkout, Webhooks, Billing Portal)
- **Rate limiting:** Upstash Redis (@upstash/ratelimit)
- **Email:** Resend (drip campaigns, digests, contact)
- **Validation:** Zod v4
- **Data fetching:** SWR
- **Deployment:** Vercel
- **Testing:** Vitest + Testing Library; Playwright E2E (npm run test:e2e)
- **Monitoring:** Sentry; Vercel Analytics + Speed Insights

## Project Structure
```
src/
  app/
    (auth)/        # Login, signup, forgot-password, reset-password
    (dashboard)/   # 14 pages: dashboard, create, bulk, history, calendar,
                   #   accounts, settings, templates, team, series, repurpose,
                   #   review, analytics, admin
    (legal)/       # Legal pages
    api/           # 57 route handlers — see "API Surface" below
    [marketing]/   # Public pages: pricing, features, blog, faq, compare,
                   #   testimonials, use-cases, roadmap, changelog, status, etc.
    page.tsx       # Landing page
    layout.tsx     # Root layout with ThemeProvider, Analytics
  components/      # Shared components (shadcn/ui + custom)
    ui/            # shadcn/ui primitives
  lib/             # Utilities — supabase/, platforms/, openai, openai-tts, stripe,
                   #   subscription, rate-limit (Upstash), ssrf, token-crypto,
                   #   webhook-dispatcher, api-keys, content-score, optimal-times,
                   #   series-runner, audit-log, email, i18n, translations
  proxy.ts         # Next.js 16 middleware (proxy.ts convention)
supabase/
  schema.sql       # Database schema with RLS policies
  migrations/      # Incremental migrations (see MEMORY for pending-on-prod list)
```

## API Surface (high-level)
- **Generation:** generate, generate-variants, generate-carousel, generate-image,
  repurpose, hashtags, score, review, series (+ series/run)
- **Video pipeline:** generate-video-script, generate-video-assets,
  generate-video-from-site, generate-video-ad, generate-voiceover, render-video
- **Brand voice:** brand-voice/analyze
- **Publishing:** publish, schedule, accounts (connect/callback), auth/oauth/*
- **Billing:** stripe/checkout, stripe/portal, stripe/webhook
- **Teams & referral:** team (+ invite/accept/members), referral (+ claim)
- **Platform/API:** v1/generate, keys, webhooks/manage, webhooks/test
- **Cron:** cron/publish, cron/sync-metrics, cron/email-drip,
  cron/generate-series, cron/weekly-digest
- **Admin/ops:** admin/*, audit, metrics, insights, health, import, track

## Key Commands
- `npm run dev` — Start dev server (Turbopack)
- `npm run build` — Production build
- `npm test` — Run unit tests (Vitest)

## Business Logic
- **Plans** (entitlement logic in src/lib/subscription.ts):
  - Free: 10 generations/mo, 0 videos (VIDEO_QUOTA_FREE)
  - Pro ($9/mo): 100 generations/mo, 5 videos (VIDEO_QUOTA_PRO)
- Video quota is tracked separately from text generations (a video ~$0.30 OpenAI vs ~$0.001 text)
- Never hardcode plan limits in routes/UI — read from subscription.ts
- Pro-only routes (PRO_ONLY_FEATURES): generate-image, generate-carousel,
  generate-variants, generate-video-script, generate-video-ad
- `isProSubscription` treats `past_due` as entitled (Stripe Smart Retries); only canceled/unpaid revokes access
- Rate limiting via Upstash Redis: 10 requests / 60s per user (in-memory fallback if Redis unset)
- Generation + video counters reset monthly via Supabase

## Features
- **Bilingual UI (EN/DE):** Dashboard i18n via LanguageProvider (public content pages are EN-only)
- **Post Generation:** AI posts with 5 tones for 5 platforms; variants, carousels, images
- **Brand Voice:** trainer + STYLE_GUARDS prompts; voice-preserving repurpose
- **Video Studio:** script -> assets -> voiceover (OpenAI TTS) -> render; video-from-site
- **Series:** website-aware multi-post series generation (cron-driven)
- **History/Calendar:** status filter (draft/scheduled/published); best-time hints
- **Accounts:** Platform OAuth (LinkedIn, Facebook, Instagram, Pinterest, Twitter/X) with real publishing via cron; manual-publish reminder when OAuth missing
- **Teams & Referral:** invites/members, referral bonus flow
- **Public API:** v1/generate with API keys; outbound webhooks
- **Dark/Light Mode:** Theme toggle with next-themes

## Important Notes
- Next.js 16 uses `proxy.ts` file convention, not `middleware.ts`
- All auth pages use Supabase client-side auth
- Stripe webhooks handle subscription status updates
- RLS on all tables; Teams policies use a SECURITY DEFINER helper to avoid 42P17 self-recursion (see MEMORY)
- OAuth tokens stored encrypted via src/lib/token-crypto.ts — never store raw tokens
- Outbound URL fetches (website-scraper, video-from-site) must go through src/lib/ssrf.ts guard
- PG16+ SECURITY DEFINER functions can't set role; use the app.bypass_field_guard GUC (see MEMORY)
- Platform OAuth is live: /api/auth/oauth/{connect,callback,disconnect}
- Cron endpoints process scheduled posts, metric sync, email drip, series, and weekly digest
- Vercel Hobby cron limit: max 1x/day per job (accepted constraint)
