# SocialBoost

## Project Overview
SaaS web app that generates AI-powered social media posts for multiple platforms (LinkedIn, Facebook, Instagram, Pinterest, Twitter/X).

## Tech Stack
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4, shadcn/ui components
- **Auth & DB:** Supabase (PostgreSQL, Auth, RLS)
- **AI:** OpenAI API (gpt-4o-mini)
- **Payments:** Stripe (Checkout, Webhooks, Billing Portal)
- **Deployment:** Vercel
- **Testing:** Vitest + Testing Library
- **Analytics:** Vercel Analytics

## Project Structure
```
src/
  app/
    (auth)/        # Login, signup, forgot-password, reset-password
    (dashboard)/   # Dashboard, create, history, calendar, accounts, settings
    api/           # API routes (generate, stripe)
    page.tsx       # Landing page
    layout.tsx     # Root layout with ThemeProvider, Analytics
  components/      # Shared components (shadcn/ui + custom)
    ui/            # shadcn/ui primitives
  lib/             # Utilities (supabase, openai, stripe, rate-limit, i18n, translations)
    supabase/      # Supabase client, server, middleware
    platforms/     # Platform-specific publishers (future)
supabase/
  schema.sql       # Database schema with RLS policies
```

## Key Commands
- `npm run dev` — Start dev server (Turbopack)
- `npm run build` — Production build
- `npm test` — Run unit tests (Vitest)

## Business Logic
- **Free plan:** 10 generations/month
- **Pro plan ($9/mo):** 100 generations/month
- Rate limiting: 10 requests/minute per user on /api/generate
- Generation counter resets monthly via Supabase

## Features
- **Bilingual UI (EN/DE):** Dashboard i18n via LanguageProvider (public content pages are EN-only)
- **Post Generation:** AI-powered posts with 5 tones for 5 platforms
- **History:** Post list with filter by status (draft/scheduled/published)
- **Calendar:** View scheduled posts
- **Accounts:** Platform OAuth (LinkedIn, Facebook, Instagram, Pinterest, Twitter/X) with real publishing via cron
- **Dark/Light Mode:** Theme toggle with next-themes

## Important Notes
- Next.js 16 uses `proxy.ts` file convention, not `middleware.ts`
- All auth pages use Supabase client-side auth
- Stripe webhooks handle subscription status updates
- RLS policies on all tables (profiles, posts, connected_accounts)
- Platform OAuth integration is live: /api/auth/oauth/{connect,callback,disconnect}
- Cron endpoint /api/cron/publish processes scheduled posts and pushes to connected platforms
