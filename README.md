# Limon

Limon turns a Google Maps restaurant link into a generated landing page. A
submission creates a pending Neon record, redirects to a generation screen, and
imports the restaurant once. The completed page is then served from stored JSON;
normal page views do not call Apify or Google Places.

The importer has three provider paths:

- Apify Google Maps Scraper when `APIFY_PERSONAL_API_TOKEN` is set.
- Optional fallback enrichment through Places API (New).
- A final zero-configuration fallback using Google's public Maps preview payload.

Restaurant photos, reviewer avatars, and review images retained by the normalized
model are copied to Vercel Blob. Neon stores the final `Restaurant` object in a
`JSONB` column. Pages remain available at `/{restaurant-slug}` for local and
preview deployments; production uses `https://{restaurant-slug}.limon.lat`.

Limon also has a separate, rights-verified menu pipeline. It accepts only
restaurant-owned uploads from a provisioned representative. Source grants,
private source assets, immutable menu versions, field evidence, extraction jobs,
and the restaurant's single public menu pointer are stored separately. Google
Maps, Places, and Business Profile content never enters this menu pipeline.

Wildcard production routing is handled by `src/proxy.ts`. The `limon.lat` DNS
zone must use Vercel's `ns1.vercel-dns.com` and `ns2.vercel-dns.com`
nameservers so Vercel can issue and renew the `*.limon.lat` certificate.

## Run locally

```bash
bun install
bun run db:migrate
bun dev
```

Open [http://localhost:3000](http://localhost:3000), paste a full Google Maps place
URL, and submit the form.

## Required services

Set these values in `.env` or `.env.local`:

```bash
DATABASE_URL=postgresql://...
APIFY_PERSONAL_API_TOKEN=apify_api_...
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
MENU_SESSION_SECRET=a-random-secret-with-at-least-32-characters
MENU_BLOB_READ_WRITE_TOKEN=vercel_blob_rw_private_...
MENU_DOCUMENT_PROCESSOR_URL=https://processor.example/internal/process
MENU_DOCUMENT_PROCESSOR_TOKEN=a-private-service-token
CRON_SECRET=a-separate-random-cron-secret
```

`DATABASE_URL` should be a Neon pooled connection string. Run `bun run db:migrate`
after connecting a new database. The SQL source is in
`db/migrations/001_restaurants.sql`.

The Blob store must be public because restaurant media is rendered directly on
public pages. On Vercel, a connected Blob store can use `BLOB_STORE_ID` and the
platform-provided OIDC token instead of a static read-write token.

Menu source files use a separate **private** Blob store configured through
`MENU_BLOB_READ_WRITE_TOKEN`. Source URLs are never rendered into browser HTML;
an authorized route streams a source only after re-checking the representative
session. Production also fails closed unless `MENU_DOCUMENT_PROCESSOR_URL` is
set. The processor receives raw bytes without local decoding, must execute in an
isolated worker, reject malware and active document content, and receives
`x-content-sha256` and `x-detected-content-type` headers. It must return JSON
containing `clean: true`, `safeToProcess: true`, `scanner`, `version`, a
same-MIME `transformedBase64`, bounded dimensions/page count, perceptual hash,
and transformation names. For local-only development,
`MENU_ALLOW_DEVELOPMENT_SCANNER=true` enables a deterministic EICAR signature
check. That development scanner is rejected in production.

## Menu workflow

Run the migrations, then provision a representative after completing the
restaurant's out-of-band identity and authority verification:

```bash
bun run db:migrate
bun run menu:provision -- <restaurant-id> "Representative name"
```

The command prints a one-time access token. Give it to the verified
representative through the approved secure channel; Limon stores only its
SHA-256 hash. The representative signs in at `/manage/<restaurant-id>`, uploads
one PDF or a set of static JPEG/PNG/WebP pages, records the asset-specific grant,
reviews the draft, explicitly approves the immutable version, and separately
publishes it. Every action re-authorizes the HttpOnly signed session against the
restaurant and representative record.

The first extraction adapter is intentionally provider-neutral and
deterministic. It returns an empty, fail-closed draft, so no paid OCR or vision
request occurs and no value is inferred. The representative enters reviewed,
tab-separated rows linked to source pages. Prices remain decimal strings during
review and gain integer minor units only during approval after the ISO currency
is known. Safety-sensitive fields remain null in this first slice.

Uploads are capped at 4 MB total so the request remains below the deployment
platform's 4.5 MB function-body limit. Larger menus require a future governed
ingestion path rather than exposing browser-side signed upload credentials.

Revocation clears the public pointer before any deletion work starts. The
retryable cascade deletes private originals and transforms, removes OCR records,
wipes model checkpoints and derived menu content, and retains only non-content
audit identifiers. Call the protected endpoint below from a scheduler to expire
time-limited grants and retry deletion jobs:

```text
POST /api/cron/menu-retention
Authorization: Bearer $CRON_SECRET
```

The menu launch remains **NO-GO** until the Phase 0-4 gates in
`docs/research/apify-menu-images-and-vision.md` pass. In particular, adding the
workflow does not authorize Google-derived menu acquisition, select a production
model, satisfy the required benchmark, or approve automatic publication.

## Places fallback

Copy `.env.example` to `.env.local` and set a Google Maps Platform key with Places
API (New) enabled:

```bash
GOOGLE_MAPS_API_KEY=your-key
```

The key remains server-side. When Apify is unavailable and this key is configured,
Limon uses Place Details for phone, hours, rating, reviews, and photos. If that
request also fails, the importer falls back to the public preview parser.

## POC constraints

- Google Maps' private preview payload is undocumented and can change without
  notice. All indexing into that payload is isolated in `src/lib/restaurants.ts`.
- The no-key path usually provides fewer photos and no review text. Place Details
  provides a limited review set, not every Google review.
- Generation is idempotent for an identical submitted source URL. Failed jobs can
  be retried from the generation screen, and stale jobs can be reclaimed after
  five minutes.
- Provider JSON is checkpointed before media uploads, so Blob or final database
  retries do not spend another Apify call. Database leases fence stale workers,
  and each record has a four-attempt ceiling.
- Anonymous submissions are limited to eight per requester per hour in Neon. A
  production launch should add bot verification in front of the public form.
- The public restaurant route reads Neon only. Restaurant-import provider calls
  and public-media Blob writes are confined to generation; private menu writes
  occur only in the verified upload route.
- Public menu rendering follows exactly one publication pointer and additionally
  requires an immutable approved version with an active, unexpired rights grant.
  Drafts, revoked grants, expired grants, and failed deletion jobs fail closed.
- Review, photo, caching, attribution, and derivative-content use is governed by
  Google Maps Platform terms and should be reviewed before production use.
