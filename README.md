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
```

`DATABASE_URL` should be a Neon pooled connection string. Run `bun run db:migrate`
after connecting a new database. The SQL source is in
`db/migrations/001_restaurants.sql`.

The Blob store must be public because restaurant media is rendered directly on
public pages. On Vercel, a connected Blob store can use `BLOB_STORE_ID` and the
platform-provided OIDC token instead of a static read-write token.

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
- The public restaurant route reads Neon only. Provider calls and Blob writes are
  confined to the generation endpoint.
- Review, photo, caching, attribution, and derivative-content use is governed by
  Google Maps Platform terms and should be reviewed before production use.
