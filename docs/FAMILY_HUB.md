# Family Hub — implementation and reviewed rollout

Issue: https://github.com/namorbru-rgb/knowledge-vault/issues/22

## Verified architecture and urgent live findings (2026-10-13)

Read-only project inspection confirms `nixakeaiibzhesdwtelw` is the existing healthy
Supabase project in eu-central-2, PostgreSQL 17. The browser talks directly to the
Data API/Storage, so backend-only checks cannot secure it. Several live `kv_*`
tables have permissive `USING(true)` / `WITH CHECK(true)` policies for anonymous
and authenticated roles. `kv-media` is public. Unrelated apps share this project
and have their own Storage policies. No production schema, user, file or data was
changed during this implementation.

The previous frontend contained shared sign-in credentials and exported them in
build settings. Removing them from the new build does not revoke previous bundles
or sessions. Before rollout, the operator must rotate that account password,
revoke existing sessions and review API keys and access logs. Do not copy the
password into an issue, PR, log or document. Treat the previous shared account's
Knowledge records as existing data; do not bulk change ownership or delete them.
Individual users will see only their own records. Plan any consented redistribution
of legacy Knowledge separately.

## Data/access contracts

- `kv_profiles` and `kv_persons` are retained. New `fh_kind` defaults to `legacy`;
  Knowledge labels are not automatically adult accounts or health profiles.
  Each account explicitly creates its own `self` profile or a child it is responsible
  for. Adult data stays under that adult's login. No real people are seeded.
- `fh_families` / `fh_members` hold family administration, separate from sensitive
  data permissions. Creation/add-member RPCs validate the authenticated caller.
  Invite adults via Supabase Auth administration, then add the account UUID to the
  family. Add the two requested administrators only after verifying their accounts;
  never promote by an email string or user-editable metadata. Children have no login.
- `fh_resources` stores health entries and document metadata. Owner, person, kind
  and file identity are immutable. `fh_grants` explicitly grants `read` or `edit`
  for one resource; only its owner manages grants/deletion. Family admin is not an
  access rule. Child access can be shared with another caregiver per resource.
- `fh_document_refs` links one stored document to multiple same-owner/same-person
  resources. Sharing a case does not share its documents or other case entries.
- `fh_doses` records one daily checkbox per medication/time slot. Dates use local
  calendar days, not UTC midnight. Plans support medication, vitamins and supplements.
- `fh_extractions` stores pending proposals, document hash/source/model and
  confidence. Only a trusted backend inserts proposals; only the owner can confirm
  or reject via an atomic RPC. Re-review is denied. Confirmed output remains in a
  separate metadata field and is never an automatic diagnosis or medication order.
  Confidence is a model estimate, not calibrated clinical certainty.
- `fh_audit` records changes, shares, doses, references, extraction reviews and
  authorised document-opening requests, without copying health payloads. Users
  cannot edit the audit. Direct Storage requests/logs are separate; the app log is
  not a tamper-proof audit of every possible database read.
- `fh-vault` accepts PDF/JPEG/PNG/WebP up to 20 MB and is private. Signed links last
  60 seconds (Knowledge photos: 300 seconds). Revocation denies new links; already
  issued links remain usable until expiration. Storage objects are not overwritten.
- Restrictive ownership fences protect Knowledge even while old permissive
  policies exist. Bucket fences protect only `kv-media` and `fh-vault`, preserving
  unrelated apps. Internal definer lookup functions use an empty search path,
  check `auth.uid()`, live in `fh_private`, and have PUBLIC EXECUTE revoked. They
  resolve policy recursion without granting admin access to data.

## Functionality and operating limits

The hub registers Knowledge, Health and Documents and reserves stable module IDs
for insurance, contracts, finance, accounting, tax and calendar. Existing Knowledge
routes remain accessible. Health supports symptom catalog, intensity, timeline,
cases, visits, hospitalisations, examinations, prescriptions, dosage schedules,
daily checks, nutrition favorites, optional dictation and in-app reminders.
Medical details currently use an editable notes field; this is not an electronic
prescribing system. Background/push reminders are not implemented. Dictation
requires an explicit action and may use the browser vendor's speech service.

Optional AI extraction needs an HTTPS backend plus `ANTHROPIC_API_KEY` and a
reviewed active `FAMILY_EXTRACTION_MODEL`. Each request requires the owner to
consent to sending that single file to Anthropic. Processing uses bounded memory,
no public URL, no shared temp file, no file/content logging and no automatic write
of accepted data. Provider errors fail closed. Model calls were not performed with
real data or paid credentials in verification. Extraction is limited to three requests
per user/hour and three concurrent requests per process. Shared limits at the proxy
are required for multiple workers. Operator consent to provider retention/region
and a real synthetic-file provider smoke test are rollout
requirements. No existing medical records have been imported; an import of an
adult's records requires that adult's explicit consent.

## API for humans and future authorised agents

Use `Authorization: Bearer <personal Supabase access token>` over HTTPS. Legacy
Knowledge API keys are explicitly denied on `/api/family`; they have no sensitive
scopes. Responses use `Cache-Control: no-store`. The backend uses the verified
user's JWT for database and Storage calls, plus explicit owner/edit checks.

| Method/path | Purpose |
| --- | --- |
| GET `/api/family/resources` | RLS-visible resources (bounded to 500) |
| POST `/api/family/resources` | Owner-bound health entry, allowlisted fields |
| PATCH `/api/family/resources/:id` | Owner or explicit edit grant |
| POST `/api/family/documents/:id/url` | Authorised 60-second link, audited |
| POST `/api/family/documents/:id/extraction` | Owner only; `{ "consent": true }` |
| POST `/api/family/resources/:id/grants` | Owner's explicit recipient/permission |
| DELETE `/api/family/resources/:id/grants/:recipient` | Owner's revocation |

The browser uses the same RLS tables/RPCs for its forms and uploads. Any future MCP
adapter must use personal authorisation and show a concrete proposed write before
execution; no unrestricted service-role MCP endpoint exists in this change.

## Validation and safe rollout

The mobile browser test runs with `npm run test:browser` after
`npx playwright install chromium`. It mocks remote services using synthetic data
and covers login, a recurring health entry, Documents, Knowledge and logout.

Run `npm ci`, `npm ci --prefix backend`, `npm ci --prefix frontend`, `npm test`,
`npm run build`, plus production dependency audits. PostgreSQL/PGlite tests use
synthetic users and simulate the live permissive policies: owner/stranger/admin,
grants, revocation, reassignment, Storage, extraction confirmation and Knowledge
regression. PGlite does not exercise the hosted Storage API/JWT validation or
production defaults. Those require a staging rehearsal with the deployed schema.
Frontend build-tool transitive advisories remain in Tailwind 3; production dependency
audits pass. Build only trusted source, never expose the development server publicly.

1. Review the PR; do not merge/deploy automatically. Back up the existing schema,
   data, policies and bucket configuration. Verify the actual backend environment's
   SUPABASE_URL and frontend build URL both match the inspected project.
2. Rehearse migration against a database restored from a schema snapshot. Historical
   `database/schema.sql` is not a fresh-install baseline (it refers to tables before
   their creation). Do not rerun it on production. Inventory any definer functions
   in the full restored schema; ensure no pre-existing RPC bypass exposes Knowledge.
3. Apply `supabase/migrations/20261013185309_family_hub.sql` once through the
   operator's reviewed migration process. The transaction is atomic; a second apply
   deliberately fails rather than silently duplicating/replacing policies. No online
   migration was applied by Codex. Refresh the Data API schema cache if needed.
4. Rotate/revoke the old shared credentials/sessions. Create separate invited accounts,
   verify identities and admin roles, and set up health profiles explicitly. No
   automatic real-person seed or old-health-record import is permitted.
5. Run hosted RLS/Storage/auth tests using synthetic accounts, including unauthenticated
   public URLs, an admin without grants, signed-link expiry and a revoked grant. Run
   Supabase security advisors and review new findings before enabling uploads.
6. Configure backend `SUPABASE_URL`, `SUPABASE_ANON_KEY`, service key (server only),
   HTTPS/CORS, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optional
   `VITE_FAMILY_API_URL` (repository variable). Secrets never go in source control.
7. Deploy backend and reviewed frontend only after migration and hosted tests pass.
   The existing main push workflow deploys GitHub Pages; do not merge ahead of this
   gate. The existing published URL is not evidence this version has been deployed.

## Rollback

Keep restrictive security fences and private `kv-media` on every rollback. Never
restore the previous shared-login build or public Storage installer. Prefer turning
off the new module routes and retaining the additive schema/data while repairing.
`database/rollback_family_hub.sql` is only for an unused migration: it refuses to run
once families, resources or vault objects exist. After use, back up/export new data
and arrange a reviewed data-preserving recovery; do not drop the new tables. A
failed migration transaction rolls back automatically without changing Knowledge.

Sources consulted: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Storage access control](https://supabase.com/docs/guides/storage/security/access-control),
[Claude PDF input](https://platform.claude.com/docs/en/build-with-claude/pdf-support).
