# Family Hub — operations and access contract

Issue: https://github.com/namorbru-rgb/knowledge-vault/issues/22
App: https://namorbru-rgb.github.io/knowledge-vault/

## Rollout on 2026-10-13

The user authorised finishing the rollout after the initial draft PR. Both the
database and HTTPS Edge runtime now use the existing project
`nixakeaiibzhesdwtelw`; no new repository or Supabase project was created.

- Actual Knowledge schema was snapshotted and the migrations rehearsed locally.
- Existing Knowledge rows, policies, bucket settings and object metadata were
  copied into non-exposed schema `fh_rollout_backup_20261013` before migration.
  This backup has no privileges for anonymous/authenticated users.
- All five migrations in `supabase/migrations` were applied. Existing inventories
  remain 499 videos, 12 links, 2 photos and 1 note. Both `kv-media` and `fh-vault`
  are private. No Knowledge ownership was reassigned.
- The old published shared password was rotated and all sessions for that shared
  account revoked; verification found zero remaining sessions. Its existing data
  remains under that account. The account holder must set a personal password.
- `family-api` is deployed over HTTPS. Browser requests validate the personal JWT
  and an active Auth session; cron requests use a separate Vault-held secret.
  Gateway JWT verification is disabled because the body authenticates both of
  these distinct flows explicitly. Legacy Knowledge API keys are denied.
- Cron job `family-hub-reminders` runs every minute. VAPID and cron credentials are
  in Supabase Vault, not GitHub/source. Notifications contain no health details.
- Hosted synthetic-account checks passed: login/session enforcement, owner and
  stranger isolation, admin without permission, read/edit grants, revocation,
  private Storage upload/sign/download, unauthenticated rejection and revoked JWT.
  Synthetic accounts/resources/files are removed after verification.
- Security advisors were checked. Exposed Hub RPCs now use invoker wrappers;
  privileged authenticated implementations are in `fh_private` with auth checks,
  fixed empty search paths and PUBLIC EXECUTE revoked.

The temporary administrative rollout function is retired after verification and
is not a supported app or agent endpoint. It must never be used as a permanent
service-role proxy.

## External dependencies still requiring account-owner action

Real-provider smoke tests failed on account configuration: Anthropic reported
insufficient credit; OpenAI rejected its configured key (HTTP 401). No real
document/health data was used for these tests. The app supports either provider,
names the selected provider before consent and fails closed if its access fails.
Set a valid `OPENAI_API_KEY`/`OPENAI_KEY` or fund the existing Anthropic account
(`ANTHROPIC_KEY`/`ANTHROPIC_API_KEY`) in Edge Function secrets. Do not send keys in
chat or put them in GitHub. AI fields are never accepted automatically.

The project's Auth redirect allow-list currently rejects the GitHub Pages return
URL and falls back to localhost. The browser's logged-in Supabase account did not
have access to this project, so no unrelated Auth settings were changed. An
operator with the correct dashboard account should add
`https://namorbru-rgb.github.io/knowledge-vault/` to allowed redirect URLs, preserving
all existing app URLs. The login screen already supports pasting the original
Supabase confirmation/recovery link and verifying it directly, independent of that
redirect. Users request their own email; Codex did not email other people.

Roman and Katarina already have confirmed Auth accounts. No real health/child
profiles, family roster or adult medical records were automatically seeded. Adults
set up their own profiles and consent to shares; family admins are assigned from
verified account IDs through the Family screen. Luzia's email/account activation
needs her chosen address. Children remain profiles under a caregiver, without login.

## Data and permission rules

- Existing `kv_profiles` and `kv_persons` remain intact. New `fh_kind='legacy'`
  preserves Knowledge labels. `self` and `child` classification is explicit.
- `fh_families` / `fh_members` administer a family. Admin status never grants
  health, financial or document access. Roles do not come from editable JWT metadata.
- `fh_resources` stores health and document metadata. Owner/person/kind/file
  identity cannot be reassigned. Restrictive fences also require a current Auth
  session, so revoking a session blocks an otherwise unexpired JWT immediately.
- `fh_grants` authorises one resource as read/edit. Only its owner controls shares
  and deletion. Linked case entries/documents each need their own explicit share.
- `fh_document_refs` links one file to multiple same-owner/same-person resources.
- `fh_doses` deduplicates one check per local date and prescribed time slot. Only
  medication resources with valid HH:MM schedules accept checks.
- `fh_extractions` holds proposals and source document hash/provider/model plus
  confidence. Trusted backend inserts only a proposal for the verified owner's
  selected file. Owner-only confirmation is atomic and cannot be repeated. Model
  confidence is an uncalibrated estimate, not clinical certainty.
- `fh_audit` logs writes, shares, dose checks, references, document opening requests
  and extraction reviews without copying medical payloads. Direct Data/Storage
  reads have separate platform logs; this is not a tamper-proof log of every read.
- `fh-vault` accepts PDF/JPEG/PNG/WebP up to 20 MB. Document links expire after
  60 seconds; Knowledge photo links after 300 seconds. A previously issued signed
  link survives share revocation until expiry. Storage does not overwrite objects.
- Knowledge ownership and Storage fences override legacy open policies, while
  preserving unrelated apps in the shared project. Photo metadata must point to
  its owner's own folder, including for legacy service-role workers; traversal and
  encoded paths are rejected.

## Reminders, AI and API operation

Health supports symptoms/intensity/timeline, cases, visits, hospitalisations,
examinations, prescriptions, medication/vitamin/supplement schedules, daily checks,
nutrition favorites and optional dictation. Clinical detail uses editable notes,
not automatic prescribing. Browser dictation starts only on user action and may
use the browser vendor's speech service.

Push is opt-in per device from Health. On iOS/iPadOS install the app on the Home
Screen first. Device subscriptions belong to a personal Auth session and are
removed when that session is revoked. Daily schedule calculations use the device's
IANA time zone. The outbox deduplicates deliveries, leases jobs, retries failures
up to three times and removes expired subscriptions. Push endpoints are restricted
to Chrome/Firefox/Apple services; arbitrary URLs cannot be used as a network proxy.
Operating-system permissions, connectivity and notification delivery still apply.

AI requests explicitly consent to one provider; there is no silent cross-provider
fallback. Extraction uses bounded memory, no public URLs/temp files/content logs
and no model-selected database actions. The database enforces a shared three-per-
user/hour quota and at most three active jobs. Provider processing/retention follows
that provider's terms; OpenAI Responses calls use `store:false`.

The browser uses RLS tables and RPCs for its forms. The live Edge actions are
`status`, `push-config`, `extraction-config`, `extract` and secret-authenticated
`dispatch`. A future MCP adapter must preserve personal authorisation and confirm
concrete writes. The optional Node `/api/family` adapter retains its owner/edit
checks and never gives legacy API keys sensitive-data scopes.

## Verification and recovery

Run `npm ci`, `npm ci --prefix backend`, `npm ci --prefix frontend`, `npm test`,
`npm run test:browser` (after `npx playwright install chromium`) and `npm run build`.
Production dependency audits pass. Tailwind 3 build-time transitive advisories
remain; do not expose development servers or compile untrusted source.

Keep all security fences/private buckets on recovery. After runtime installation,
rollback means disabling new module routes and the reminder cron while retaining
the schema/data, then repairing forward. `database/rollback_family_hub.sql` only
accepts an unused initial migration and refuses both real data and installed runtime.
Never restore the old shared-login/public-storage build. Backups in the private
schema require an authorised database operator; never grant them to app clients.

Sources: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Storage access](https://supabase.com/docs/guides/storage/security/access-control),
[scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions),
[Web Push](https://github.com/web-push-libs/web-push),
[OpenAI file inputs](https://developers.openai.com/api/docs/guides/file-inputs).
