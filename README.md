# Mai Live Wars — MAI Corp MVP

Mai Live Wars is a standalone MAI Corp mobile-first live creator battle app. The repository contains the redesigned React/TypeScript interface, Capacitor configuration, Supabase migrations and Edge Function scaffolding, GetStream Video RTC integration, PayPal checkout/payout workflows, AI audio-caption moderation, and an in-app route-gated admin control room.

**Do not treat this repository as production-ready until the external credentials, migrations, Edge Functions, moderation provider, PayPal business approval, mobile payment policy, and real-device tests are complete.** The app intentionally does not fabricate live rooms, wallet balances, payments, or moderation activity when the backend is not connected.

## Product decisions

- **Brand:** Mai Live Wars — an MAI Corp product.
- **Platforms:** Android and iOS via Capacitor, plus a PC web version for account access, Bullet purchases, battle browsing, live viewing, and joining waiting rooms. Battle creation is mobile-only; Bullet purchases are web-only.
- **Backend:** Supabase Auth, PostgreSQL, Storage, Realtime, and Edge Functions.
- **RTC:** GetStream Video SDK. Participant tokens are issued server-side; the API secret is never bundled in the app.
- **Payments:** PayPal Orders/Capture for supported purchase flows and PayPal Payouts for eligible creator cashouts. App-store rules for digital currency must be followed.
- **Roles:** exactly `user` and `admin`.
- **Application identity:** all business tables reference `public.user_profiles(id)` rather than relying only on `auth.uid()`. `user_profiles.user_id` maps a profile to Supabase Auth.
- **Currency:** Bullets. Purchased Bullets and creator earnings are separate balances. Purchase conversion is 125 purchased Bullets per $1; cashout conversion is 375 eligible earnings Bullets per $1. Initial minimum: 3,750 eligible earnings Bullets for $10.
- **Cashouts:** requests are scheduled for Monday/Friday in America/Chicago time, subject to verification and payment processing.
- **Battle formats:** 1v1 through 6v6. The universal arena renders a format-sized team grid for RTC feeds and waiting placeholders.
- **Battle modes:** Standard and Fast = 180 real seconds; Slow = 180 displayed seconds at 0.5x countdown (360 real seconds); State Battle displays the user's selected state.
- **No rematches and no sudden death.** A server-authoritative timer starts only when the required battle participants are connected.
- **Marketing recording:** off by default. Explicit opt-in is recorded separately. Do not activate promotional recording unless every participant in that specific battle has consented and the recording notice is displayed.
- **AI moderation:** battle chat and trusted GetStream transcription webhooks use a shared server-side classifier (OpenRouter preferred, OpenAI moderation as compatibility fallback). Only threats, self-harm encouragement/instructions, and sexual content are in scope; harassment and ordinary game language are not independently penalized. Confirmed offenses produce a warning on the first strike, a 30-second account-wide chat timeout on the second, and an account ban on the third. Sanctions are stored in an idempotent database ledger and block chat and new battle participation account-wide.
- **SEO:** static policy/product pages are generated under `public/seo/`. They can be hosted on the default hosting subdomain; a paid custom domain is not required.

## Design and app experience

The app uses the MAI Corp neon blue, green, and purple visual system; animated ambient backgrounds; responsive battle-format cards; synthetic UI sound cues that do not require audio files; sound toggle; state-battle selection; route-gated admin navigation; a secure account/profile flow; and footer legal links with “All rights reserved.”

The battle room uses the official GetStream Video SDK participant views inside one format-driven universal arena. Each team displays one through six slots according to the selected format; larger formats use additional grid columns and rows. When fewer participants have joined, the remaining slots are shown as waiting placeholders. A room remains in the waiting state until all required participants connect.

## Setup

### 1. Install dependencies

Use Node 22 or a compatible current Node release, then run:

```bash
npm install
cp .env.example .env.local
```

The uploaded ZIP contained a `node_modules` folder from a different environment. Do not reuse it. Run `npm install` after extracting this cleaned source so platform-specific optional dependencies and the GetStream packages are installed correctly.

### 2. Configure the public client environment

Populate `.env.local` with:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GETSTREAM_API_KEY`
- `VITE_PUBLIC_APP_URL` if a hosted SEO/callback URL is available

Only public values belong in `VITE_` variables. Never put the Supabase service-role key, GetStream API secret, OpenAI/OpenRouter API keys, or PayPal client secret in `.env.local` or any client bundle.

### 3. Configure server-only secrets

Use `supabase/functions/.env.example` as a checklist, but do not commit real values. Set secrets through the Supabase CLI or project secret manager, for example:

```bash
supabase secrets set \
  SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
  SUPABASE_ANON_KEY="YOUR_ANON_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
  GETSTREAM_API_KEY="YOUR_GETSTREAM_API_KEY" \
  GETSTREAM_API_SECRET="YOUR_GETSTREAM_API_SECRET" \
  OPENROUTER_API_KEY="YOUR_OPENROUTER_API_KEY" \
  OPENROUTER_MODERATION_MODEL="YOUR_OPENROUTER_MODEL_ID" \
  PAYPAL_ENV="live" \
  PAYPAL_CLIENT_ID="YOUR_PAYPAL_CLIENT_ID" \
  PAYPAL_CLIENT_SECRET="YOUR_PAYPAL_CLIENT_SECRET" \
  PAYPAL_WEBHOOK_ID="YOUR_PAYPAL_WEBHOOK_ID" \
  PUBLIC_APP_URL="YOUR_HOSTING_SUBDOMAIN_URL" \
  PAYPAL_RETURN_URL="YOUR_HOSTING_SUBDOMAIN_URL/paypal-return" \
  PAYPAL_CANCEL_URL="YOUR_HOSTING_SUBDOMAIN_URL/profile"
```

Replace every placeholder with values from your own provider accounts. Do not send secrets in chat or commit them to the repository.

### 4. Apply migrations in order

The migrations are intentionally split into separate files. Apply them in timestamp order:

1. `202610120001_core_profiles_consent.sql`
2. `202610120002_battles_streaming.sql`
3. `202610120003_bullets_wallet_payments.sql`
4. `202610120004_moderation_notifications_audit.sql`
5. `202610120005_storage_and_guardrails.sql`
6. `202610120006_trusted_rpcs.sql`
7. `202610120007_payout_recipients_and_admin_review.sql`
8. `202610120008_matchmaking_and_state_identity.sql`
9. `202610120009_authoritative_battle_finalization.sql`
10. `202610120010_stream_webhook_events.sql`
11. `202610120011_gift_transactions_and_recording_policy.sql`
12. `202610120012_cashout_settlement.sql`
13. `202610120013_battle_chat.sql`
14. `202610120014_join_existing_battles_recording_consent.sql`
15. `202610120015_service_role_rpc_grants.sql`
16. `202610120016_wallet_transaction_foreign_keys.sql`
17. `202610120017_account_erasure_workflow.sql`
18. `202610120018_stream_viewer_sessions.sql`
19. `202610120019_product_rules_and_chat_limits.sql`
20. `202610120020_moderated_battle_chat.sql`
21. `202610120021_battle_chat_moderation_throttle.sql`
22. `202610120022_account_wide_safety_sanctions.sql`

Use a dedicated new Supabase project for Mai Live Wars. Do not apply these migrations to the Mai Troll production project. Review each migration in a staging project before production.

### 5. Deploy Edge Functions

Deploy the functions from `supabase/functions/`:

- `create-battle`
- `join-battle`
- `stream-token`
- `confirm-battle-connection`
- `leave-battle`
- `finalize-battle`
- `send-battle-gift`
- `send-battle-chat`
- `getstream-webhook`
- `paypal-create-order`
- `paypal-capture-order`
- `paypal-webhook`
- `request-cashout`
- `paypal-payout`
- `admin-cashout-review`
- `admin-verify-payout-recipient`
- `admin-update-package`
- `admin-system-health`
- `admin-process-account-deletion`
- `save-payout-recipient`
- `request-account-deletion`
- `update-recording-consent`
- `admin-terminate-battle`

Example:

```bash
supabase functions deploy create-battle
supabase functions deploy join-battle
supabase functions deploy stream-token
supabase functions deploy confirm-battle-connection
supabase functions deploy leave-battle
supabase functions deploy finalize-battle
supabase functions deploy send-battle-gift
supabase functions deploy send-battle-chat
supabase functions deploy getstream-webhook
supabase functions deploy paypal-create-order
supabase functions deploy paypal-capture-order
supabase functions deploy paypal-webhook
supabase functions deploy request-cashout
supabase functions deploy paypal-payout
supabase functions deploy admin-cashout-review
supabase functions deploy admin-verify-payout-recipient
supabase functions deploy admin-update-package
supabase functions deploy admin-system-health
supabase functions deploy admin-process-account-deletion
supabase functions deploy save-payout-recipient
supabase functions deploy request-account-deletion
supabase functions deploy update-recording-consent
supabase functions deploy admin-terminate-battle
```

### Edge Function debugging

Failed Supabase Edge Function requests are logged in the browser developer console with the function name, HTTP status, and returned error when available. Caught server-side errors are logged with the function name in Supabase Edge Function logs. Open the function's Logs view in the Supabase dashboard to inspect server errors.

### 6. Configure GetStream Video

1. Create a separate GetStream app for Mai Live Wars.
2. Put the public API key in `VITE_GETSTREAM_API_KEY` and the API secret in Supabase server secrets.
3. Configure video call permissions, allowed app origins, quotas, and usage alerts.
4. Configure a trusted webhook to the `getstream-webhook` Edge Function. Enable the appropriate call transcription/caption events in the GetStream dashboard and verify the webhook signature format against the active GetStream documentation before launch.
5. Test local camera/microphone permissions, multiple participants, 6v6 load, reconnection, backgrounding, and real iOS/Android devices.

The backend issues a short-lived user token. Do not put the GetStream API secret in the frontend. Live video should not be described as working until the actual SDK session connects.

### 7. Configure AI moderation

The server-side `getstream-webhook` verifies the event signature, processes supported transcription events, calls the OpenAI Moderation API, writes a restricted moderation record, and calls the server-side participant-removal RPC.

Battle chat sends use the authenticated `send-battle-chat` Edge Function. It checks battle membership, rate-limits moderation-provider requests, applies OpenAI text moderation, records blocked messages for admin review, and only then writes safe messages for Supabase Realtime delivery. If OpenAI is unavailable or not configured, chat sending fails closed rather than bypassing moderation.

Before enabling this flow:

- Confirm the exact GetStream transcription event names and payload shape for the selected product/SDK.
- Confirm webhook signature validation against the current GetStream docs and test invalid signatures.
- Test threats, self-harm content, prohibited sexual content, negation, quotations, false transcripts, overlapping speech, and speaker attribution.
- Configure incident retention and restricted admin access.
- Test provider outages and define the production fallback.

AI classification is not perfect. Do not permanently ban users solely on an ambiguous transcript. For team battles, the server removes only the offending participant; a 1v1 moderation forfeit awards the eligible opponent the win.

### 8. Configure PayPal

1. Use live PayPal credentials from a verified business app.
2. Create and activate approved Bullet packages in `public.bullet_packages`.
3. Keep the 31,500-Bullet / $2,500 package disabled. At the stated base rate of 125 Bullets per $1, that package conflicts with the conversion math and requires owner confirmation.
4. Configure and verify the PayPal webhook ID and signature verification.
5. Implement/verify the product's policy-compliant payment path for iOS and Android digital currency. PayPal redirects alone are not automatically an App Store or Google Play billing substitute.
6. Users can save a PayPal payout email. An administrator must verify the destination before payouts can be sent.
7. Creator cashouts are queued for Monday/Friday Central Time. The payout Edge Function only submits on an allowed day and updates final ledger state after a verified PayPal payout webhook.

The purchase rate and cashout rate intentionally differ: 125 purchased Bullets per $1, and 375 eligible earnings Bullets per $1. The initial cashout tier is 3,750 eligible earnings Bullets for $10. Payment provider fees are not hard-coded until the applicable PayPal account terms and API fee schedule are verified.

### 9. Bootstrap the first administrator

Create and verify your own account through the app, complete the profile, then run a one-time statement in the Supabase SQL Editor for the dedicated Mai Live Wars project:

```sql
update public.user_profiles
set role = 'admin'
where username = 'YOUR_EXACT_USERNAME';
```

Replace the username with the exact profile username. Do not expose an admin-role switch in the client. After the role is set, `/admin` is gated by the profile role and all admin actions are revalidated by the server.

### 10. SEO and hosting

The native app does not require a paid custom domain. To publish crawlable static pages, host the built app on an existing hosting provider's free/default subdomain and set `VITE_PUBLIC_APP_URL` to that real URL at build time:

```bash
VITE_PUBLIC_APP_URL="https://your-real-hosting-subdomain" npm run build
```

`prebuild` generates static pages under `/seo/`, `robots.txt`, and `sitemap.xml` when a real public URL is configured. Do not use a placeholder domain in production metadata. Static pages are provided for About, battle rules, safety, privacy, terms, and community guidelines.

### 11. Build and native packaging

```bash
npm run build
npm run lint
npx cap add android   # only if the native Android project does not exist yet
npx cap add ios       # only on macOS and if the iOS project does not exist yet
npx cap sync
```

Open the generated Android project in Android Studio and the iOS project in Xcode. Follow `docs/native-permissions.md` for camera/microphone permissions and deep-link setup. Verify push notifications, account deletion, and purchase flows in native builds. iOS compilation requires macOS/Xcode.

## Important MVP limitations to resolve before public launch

- PayPal purchase and payout flows need live testing, approved business credentials, webhook validation, and app-store policy review.
- Verify the exact GetStream SDK versions and caption/transcription event payloads against current vendor documentation. The webhook is deliberately isolated so provider changes do not spread into UI code.
- The user-facing chat is backed by Supabase Realtime. Enable `battle_chat_messages` in the project's Realtime publication if your database setup does not allow the migration to do so.
- Promotional battle recording is off by default and is not automatically started by the app. Do not enable recording until per-participant consent checks, recording-provider setup, secure storage, retention, and deletion rules are verified.
- Account deletion is a secured request/disable flow followed by an administrator-controlled anonymization and Auth deletion step. Financial and audit records may be retained where legally required.
- Gift transactions and cashout ledgers need load, replay, refund, chargeback, concurrency, and reconciliation tests before real money is enabled.
- The initial moderation integration depends on the selected GetStream account actually delivering trusted transcription events to the configured webhook. Test the full audio-to-enforcement path before relying on it.
- Configure `OPENROUTER_API_KEY` and `OPENROUTER_MODERATION_MODEL` for the moderation classifier. Provider credentials are server-only. A provider outage fails closed for chat; voice webhook events must be retried after provider errors.
- The automatic third-strike ban has no in-app appeal flow yet. An administrator must review moderation events and restore an account manually when appropriate; this remains a launch-readiness gap.

## Security rules

- Never commit `.env`, `.env.local`, service-role credentials, GetStream API secrets, OpenRouter keys, PayPal secrets, or webhook secrets.
- Only `user` and `admin` application roles are permitted.
- Never accept a score, wallet balance, cashout eligibility, or payment confirmation from a client as authoritative.
- All wallet and gift changes are performed in a database transaction through trusted Edge Functions/RPCs.
- Battle timers use server timestamps and a server-finalization RPC; clients only display the countdown.
- Marketing recording is opt-in and must remain off unless every participant in a recorded battle has consented.

### Dependency lockfile note

This handoff adds the GetStream React Video SDK to the original project. The uploaded lockfile did not contain that dependency, so the clean source archive omits the stale lockfile; run `npm install` once to resolve the SDK and generate a fresh `package-lock.json`, then commit that lockfile after a successful build and test pass.
