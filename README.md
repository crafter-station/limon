# Limon

Limon turns a Google Maps restaurant link into a generated landing page. A
submission creates a pending Neon record, redirects to a generation screen, and
imports the restaurant once. Public pages then read only from Neon and Vercel
Blob.

For the menu POC, Apify provides up to ten Google Maps restaurant photos. Limon
copies those images into the existing public Vercel Blob store and sends their
public URLs to `google/gemini-2.5-flash-lite` through Vercel AI Gateway. AI SDK 7
validates the structured menu output with Zod before Drizzle publishes it.
Photos that do not contain a readable menu are ignored by the model. This POC
does not classify or deduplicate photos before extraction and does not include
KYC, restaurant ownership verification, or human approval.

## Run locally

```bash
bun install
bun run db:migrate
bun dev
```

Open [http://localhost:3000](http://localhost:3000), paste a full Google Maps
place URL, and submit the form.

## Configuration

Copy `.env.example` to `.env.local` and configure:

```bash
DATABASE_URL=postgresql://...
APIFY_PERSONAL_API_TOKEN=apify_api_...
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
AI_GATEWAY_API_KEY=your-local-ai-gateway-key
```

`DATABASE_URL` should be a Neon pooled connection string. The Drizzle schema is
in `src/db/schema.ts`; `bun run db:migrate` pushes it to the configured database.

The Blob store is public because restaurant media is rendered on public pages
and AI Gateway receives those image URLs. On Vercel, a connected Blob store can
use `BLOB_STORE_ID` and platform OIDC instead of a static Blob token.

Vercel deployments authenticate AI Gateway through OIDC automatically. For local
development, create an AI Gateway API key and set `AI_GATEWAY_API_KEY`. Override
the default model with `MENU_VISION_MODEL` if needed.

## Generation pipeline

1. Resolve the submitted Google Maps URL.
2. Import place details, reviews, and photos with Apify.
3. Mirror retained media into the existing public Vercel Blob store.
4. Send up to ten mirrored photos to Gemini through AI Gateway.
5. Store the Zod-validated menu in `generated_menus` through Drizzle.
6. Publish the restaurant page from Neon data only.

Restaurant generation keeps the existing leases, provider checkpoint, retry
ceiling, source URL deduplication, slug collision handling, and anonymous rate
limit. Menu extraction failure does not block the rest of the restaurant page.

## POC constraints

- Google Maps photos can include food, people, interiors, storefronts, and old or
  unrelated menu photos. The vision model decides which images contain menus.
- Extracted menu data can be incomplete or incorrect and is published without
  human review in this POC.
- Generic photo imports do not establish ownership, processing, or publication
  rights. See `docs/research/apify-menu-images-and-vision.md` before treating this
  pipeline as production-ready.
- AI Gateway and Apify calls can incur usage charges.
