# Supabase Restore — 10-Minuten Playbook

**Stand:** 2026-05-25 — die Production-Supabase `swoldquaceminkvalyqb.supabase.co`
löst NXDOMAIN auf. Damit ist `https://socialboost-green.vercel.app` für Auth, DB
und Storage **tot**. Statische Seiten (Landing, Pricing, Blog) laden noch, aber
Login → `ERR_NAME_NOT_RESOLVED`.

Diese Anleitung bringt die Production wieder hoch. Du brauchst **nur einen Web-Browser
und Vercel-Zugang**, kein Coding.

---

## Schritt 1 — Supabase-Projekt anlegen (3 Min)

1. https://supabase.com/dashboard öffnen, mit deinem Account einloggen
2. **New Project** klicken
3. Werte:
   - Name: `socialboost`
   - Database Password: **Hier einen starken Pass setzen** (Bitwarden/1Password!)
   - Region: **Frankfurt (eu-central-1)** — gleiche Region wie das alte Projekt
   - Plan: Free (Pro brauchst du erst bei > 500 MB Storage oder mehr Last)
4. Warten ~2 Min bis das Projekt provisioniert ist

## Schritt 2 — Migrationen laufen lassen (3 Min)

Im Supabase Dashboard → **SQL Editor** → folgende Files **in dieser Reihenfolge**
einzeln öffnen, Inhalt kopieren, in SQL Editor einfügen, RUN klicken:

```
supabase/schema.sql
supabase/migration-v2.sql
supabase/migration-api-webhooks.sql
supabase/schema-templates.sql
supabase/migration-audit-log.sql
supabase/migration-analytics-events.sql
supabase/migration-drip-log.sql
supabase/migration-newsletter.sql
supabase/migration-2026-04-11.sql
supabase/migration-website-series.sql
supabase/migration-add-full-name.sql
supabase/migration-publish-reminder.sql
supabase/migration-video-quota.sql
supabase/migration-quota-reserve.sql
supabase/migration-teams-rls-fix.sql
supabase/migration-perf-indexes.sql
supabase/storage-migration.sql
supabase/PENDING-APPLY-ON-LIVE.sql
```

Reihenfolge ist wichtig: Tabellen vor den Migrationen, die sie indizieren/altern
(perf-indexes & PENDING zuletzt). `migration-quota-reserve.sql` muss **nach**
`migration-video-quota.sql` laufen — es nutzt deren Field-Guard-Trigger + die
`app.bypass_field_guard`-GUC (reserve/refund-RPCs für die TOCTOU-sichere Quota).
Das sind alle 18 Files — die früher fehlenden (api-webhooks, drip-log,
publish-reminder, video-quota, teams-rls-fix) sind für ein funktionierendes Prod
zwingend (ohne sie: keine Public-API/Webhooks/Drip, keine Video-Quota-Deckelung,
kaputtes Teams-RLS).

Hinweis: `schema.sql`, `schema-templates.sql`, `storage-migration.sql` und
`migration-quota-reserve.sql` sind jetzt voll idempotent (jede `create policy` hat
ein vorgelagertes `drop policy if exists`, FK-Constraints sind `pg_constraint`-
geguarded) — ein erneuter Apply läuft fehlerfrei durch (lokal auf PG 17.6
verifiziert). `migration-api-webhooks.sql` fügt die `secret`-Spalte für die
HMAC-signierten Outbound-Webhooks idempotent hinzu (`add column if not exists`).

## Schritt 3 — Storage-Buckets erstellen (1 Min)

Im Dashboard → **Storage** → **New Bucket**:

| Name | Public? |
|---|---|
| `generated-images` | ✓ Public |
| `generated-videos` | ✓ Public |

(Falls `storage-migration.sql` die schon angelegt hat — überspringen.)

## Schritt 4 — Keys & URL kopieren (1 Min)

Im Supabase Dashboard → **Settings → API**:

| Was | Wo eintragen |
|---|---|
| Project URL (`https://xxx.supabase.co`) | Vercel-Env `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` public key | Vercel-Env `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` secret key | Vercel-Env `SUPABASE_SERVICE_ROLE_KEY` |

## Schritt 5 — In Vercel updaten (2 Min)

https://vercel.com/dashboard → Projekt `socialboost` → **Settings → Environment Variables**

- Die drei Werte oben überschreiben (alte Werte löschen / replace)
- Auf **Production + Preview + Development** für alle drei haken
- **Save**

Dann **Deployments** → letzten erfolgreichen Deploy auswählen → ⋯-Menü → **Redeploy**
(„use existing build cache" off lassen, dann zieht er die neuen Env-Vars).

## Schritt 6 — Verifizieren

Nach ~30 Sek Deploy:

1. https://socialboost-green.vercel.app/login öffnen
2. Browser-DevTools (F12) → Console auf — sollte **keine** `ERR_NAME_NOT_RESOLVED` mehr werfen
3. Mit einer Test-Mail registrieren → bekommst Verification-Mail (oder im Supabase Dashboard → **Auth → Users** den User finden und manuell confirmen)
4. Login → Dashboard sollte funktionieren
5. Ein Test-Post generieren → sollte in Supabase **Table Editor → posts** auftauchen

## Schritt 7 — Memory aktualisieren

Sag mir die neue Project-Ref (aus der URL, z.B. `xyzabc123`), dann update ich die
auto-memory-Datei `project_deployment.md` mit den neuen Werten — damit das nächste
Mal sofort klar ist welches Projekt aktiv ist.

---

## Stripe-Webhook checken

Falls du Stripe-Webhooks live hast (du hast):

1. https://dashboard.stripe.com/webhooks → Webhook-Endpoint öffnen
2. URL ist nach wie vor `https://socialboost-green.vercel.app/api/stripe/webhook` — passt
3. Signing Secret nicht ändern, der ist bereits in Vercel als `STRIPE_WEBHOOK_SECRET`

Wenn du **kein Supabase-Cold-Start-Problem** mehr hast, sollten Webhooks weiter laufen.

## Cron-Endpoints checken

Vercel Hobby Cron läuft 1×/Tag automatisch — keine Änderung nötig nach Supabase-Restore.
Falls du auf häufiger willst: external Cron auf `https://cron-job.org` einrichten, alle 5 Min
`https://socialboost-green.vercel.app/api/cron/publish` mit Header
`Authorization: Bearer <CRON_SECRET>` aufrufen. CRON_SECRET liegt in Vercel-Env.

---

## Was nach dem Restore noch passiert ist (Optional)

Die Anwendung hat ein paar Code-Updates seit dem letzten Live-Deploy:

- `gpt-image-1` statt deprecated `dall-e-3` (Bildgenerierung)
- Portrait-Bilder 1024×1536 für Videos (statt square)
- Video-Render-Pipeline (worker/ Verzeichnis — separat zu Railway deployen falls du Videos rendern willst)
- Analytics-Events Tabelle (queryable Usage-Daten)
- `audit_log` Tabelle (war im Code referenziert aber Migration fehlte)
- Diverse Frontend-Bugfixes (CSP, content_score, hashtags)

Nach Restore → `git pull` lokal → `npm run build` → wenn grün, normal deployen.
Vercel pickt deine Hauptbranche automatisch.
