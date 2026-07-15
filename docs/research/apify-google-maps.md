# Apify as Limon's Google Maps data provider

**Checked: 2026-07-14.** Apify's current General and Actor Terms became effective on 2026-07-09, its DPA was updated on 2026-07-08, and Google Maps' End User Additional Terms were last modified on 2026-01-27. Google says its general Terms will change on 2026-07-30, so the legal analysis must be rechecked before launch ([Apify General Terms](https://docs.apify.com/legal/general-terms-and-conditions), [Apify Actor Terms](https://docs.apify.com/legal/actor-terms-and-conditions), [Apify DPA](https://docs.apify.com/legal/data-processing-addendum), [Google Maps Additional Terms](https://www.google.com/help/terms_maps/), [Google Terms](https://policies.google.com/terms)).

## Recommendation

**Production: NO-GO. Internal technical POC: GO with bounded reviews/images.**

Use Apify's [`compass/crawler-google-places`](https://apify.com/compass/crawler-google-places) Actor for a time-boxed POC. It accepts direct Google Maps place URLs and returns the restaurant details, reviews, and photos Limon needs in one record. Run it asynchronously, publish a `processing` state, and use the existing Places API path and undocumented preview parser as progressively degraded fallbacks.

This recommendation is based on product fit, not a claim that Apify makes the source data safe to republish. Apify's terms leave authorization, legality, accuracy, and use of extracted data with the customer. Google's current Maps terms prohibit copying content, mass downloads, redistribution/sale of Maps, and creating a new product or service based on Maps. Apify therefore reduces scraper maintenance and operational work, but **does not transfer Google's terms, copyright, review-author privacy, image-rights, or database-right risk away from Limon** ([Google Maps Additional Terms, section 2](https://www.google.com/help/terms_maps/), [Apify Actor Terms, sections 2, 5, and 7](https://docs.apify.com/legal/actor-terms-and-conditions)). Republishing review text and user photos on commercial generated sites is the highest-risk part and requires counsel plus a restaurant/content-licensing strategy before production.

### Actor comparison

Usage and success counts are Apify public API snapshots from 2026-07-14. Raw success means `SUCCEEDED / TOTAL` over 30 days, including aborted and timed-out runs; Store headline percentages use a differently filtered denominator ([Store API search](https://api.apify.com/v2/store?search=google%20maps&limit=20&offset=0)).

| Actor | Ownership and maintenance signal | URL/data fit | Decision |
| --- | --- | --- | --- |
| [`compass/crawler-google-places`](https://apify.com/compass/crawler-google-places) | Compass (Apify); about 508.6k users, 33.4k monthly, 4.76/5 from about 1,623 ratings; about 3.21m of 3.41m 30-day runs succeeded (94.2% raw). Created 2018-11-19; build `0.14.713` completed 2026-07-13; limited permissions, hidden source ([API record](https://api.apify.com/v2/actors/compass~crawler-google-places)). | Direct place URLs/IDs; details, bounded/all reviews and images, amenities, coordinates, IDs; no videos. | **Use for POC.** Best fit and strongest history. |
| [`compass/google-maps-extractor`](https://apify.com/compass/google-maps-extractor) | Compass (Apify); about 89.2k users, 3.4k monthly, 4.87/5; 96.0% raw 30-day success; latest build 2026-07-13 ([API record](https://api.apify.com/v2/actors/compass~google-maps-extractor)). | Direct URLs and core fields, but its README explicitly excludes review records and images. | Reject: incomplete and a higher base price than the full Actor. |
| [`compass/google-maps-reviews-scraper`](https://apify.com/compass/google-maps-reviews-scraper) | Compass (Apify); about 47.1k users, 5.3k monthly, 4.83/5; 99.8% raw 30-day success; latest build 2026-07-13; limited permissions, hidden source ([API record](https://api.apify.com/v2/actors/compass~google-maps-reviews-scraper)). | Direct URLs/IDs and excellent all-review rows, including review images, but not a complete source for general photos, contact, hours, or amenities. | Optional review backfill, not primary. |
| [`lukaskrivka/google-maps-with-contact-details`](https://apify.com/lukaskrivka/google-maps-with-contact-details) | Store identifies developer as Apify; about 79.9k users, 3.5k monthly, 4.52/5; 89.6% raw 30-day success; latest build 2026-07-13 ([API record](https://api.apify.com/v2/actors/lukaskrivka~google-maps-with-contact-details)). | Direct URLs/IDs and rich contact/place data; its README sends users to the full Actor for reviews/images. | Reject: wrong specialization and no coverage advantage. |
| [`solidcode/google-maps-scraper-2-5-per-1-000-results`](https://apify.com/solidcode/google-maps-scraper-2-5-per-1-000-results) | Community Actor created 2026-04-04; about 891 users, 4.91/5 from 10 ratings; 95.6% raw 30-day success; hidden source ([API record](https://api.apify.com/v2/actors/solidcode~google-maps-scraper-2-5-per-1-000-results)). | Broad place fields, but only a small photo sample and no review text/authors; complete photos require a second Actor. | Not a requirement-complete fallback. |
| [`microworlds/crawler-google-places`](https://apify.com/microworlds/crawler-google-places) | Community; about 14.7k users, 4.20/5; 78.6% raw 30-day success; hidden source ([API record](https://api.apify.com/v2/actors/microworlds~crawler-google-places)). | Despite a Compass-like title/description, its actual schema only accepts keywords/location/geofence and documented output omits direct URLs, reviews, images, hours, and description. | Reject: documented contract and reliability are materially weaker. |

No separate `apify/google-maps-scraper` was found. The credible official option is the Compass namespace, whose Store page says "Compass (Apify)" ([Compass Actor page](https://apify.com/compass/crawler-google-places)). Community Actors add risk because Apify says it does not review, vet, endorse, monitor, guarantee, or require maintenance of them, and their creators may access/control input and output ([Apify Actor Terms, section 9](https://docs.apify.com/legal/actor-terms-and-conditions)).

## Product fit

The full Google Maps Scraper supports direct place URLs through `startUrls`, including normal `/maps/place` links, `google.com/maps?cid=...`, and `goo.gl/maps` links. The current input schema says direct URLs and Place IDs fetch details directly rather than running a map search and incur the additional-place-details event. See the [Actor input and README](https://apify.com/compass/crawler-google-places/input-schema).

The schema does **not** explicitly promise support for the newer `maps.app.goo.gl` share-link domain, and public issues show these inputs returning no results or parsing failures. Limon should follow allowed redirects server-side, reject any non-Google destination, and pass the resulting canonical `google.com/maps` URL to Apify. Include app share links in the POC fixtures rather than claiming that every Google URL format works untested ([main Actor short-link issue](https://apify.com/compass/crawler-google-places/issues/google-lists-consist-OfwuHCtDKOXYtgxrE), [Reviews Actor short-link issue](https://apify.com/compass/google-maps-reviews-scraper/issues/google-maps-scraper-UjwT5Onv65ZBT2kOL)).

### Required fields

| Limon need | Actor output | Coverage |
| --- | --- | --- |
| Name and category | `title`, `subTitle`, `categoryName`, `categories` | Yes |
| Description | `description` | Partial; may be `null`, so Limon still needs generated fallback copy |
| Address and directions | `address`, address components, `location`, `plusCode`, `url` | Yes |
| Phone and website | `phone`, `phoneUnformatted`, `website` | Yes |
| Opening status and hours | `permanentlyClosed`, `temporarilyClosed`, `openingHours` | Yes; detail-page extraction required for hours |
| Rating and count | `totalScore`, `reviewsCount`, `reviewsDistribution` | Yes; detail-page extraction ensures review count/distribution |
| Review content | `reviews[]` with text, translation, stars, dates, likes, owner response, images, and detailed service ratings | Yes |
| Reviewer attribution | Name, ID, profile URL, photo, review count, Local Guide status | Optional; turn off fields Limon does not display |
| Photos | `imageUrl`, `images[]`, `imageUrls`, image count/categories, author and upload date | Yes |
| Restaurant attributes | `additionalInfo`, menu, price, reservation/order links, `restaurantData` | Yes when Google exposes them |
| Stable identifiers | `placeId`, `cid`, `fid`, `kgmid` | Yes; prefer `placeId`, retain `cid` as a secondary key |
| Google Maps videos | No documented listing-video output | No; do not promise video import |

The official output example includes a complete restaurant record with identifiers, address components, website, phone, coordinates, rating, review distribution, hours, amenities, image metadata, and nested reviews. See the [output schema and example](https://apify.com/compass/crawler-google-places/output-schema).

The formal output schema identifies the dataset/views but does not provide a strict, complete item-level JSON contract. Treat the README example as a versioned vendor payload: retain the raw response for short-term diagnostics, validate every field at one adapter boundary, and expect nulls/localized keys/schema drift.

The Actor can request a chosen number of image URLs and optional author metadata, rather than Limon's current fixed ten-photo slice. It still does not provide a license to republish those images ([main Actor image inputs](https://apify.com/compass/crawler-google-places/input-schema), [`src/lib/restaurants.ts`](../../src/lib/restaurants.ts)).

### All reviews, images, and videos

- On the main Actor, `maxReviews: 99999` and `maxImages: 99999` request all available reviews/images. Both invoke the flat detail-page event, add per-review/per-image charges, and increase runtime. One place dataset item can hold at most 5,000 nested reviews; additional chunks create duplicate place items. The dataset `view=reviews` produces one review per row ([official input schema and review FAQ](https://apify.com/compass/crawler-google-places)).
- On the dedicated Reviews Actor, omitting `maxReviews` requests all reviews. It emits one dataset row per review and supports date, keyword, sort, language, Google-only origin, and personal-data controls ([official Reviews Actor schema](https://apify.com/compass/google-maps-reviews-scraper)). Its README warns that Google-side limits and input conditions can change returned volume and recommends at most 1,000 reviews per place to control resource use ([Reviews Actor limits FAQ](https://apify.com/compass/google-maps-reviews-scraper)).
- "All" is best effort, not a completeness warranty. Review/image counts, pagination, and URLs can change with Google's UI and anti-automation behavior.
- Videos are unsupported. `imageCategories` may contain a `Videos` label, but no official place-video URL/object or video input is documented. Social enrichment reports profile post/video counts, not playable Google Maps place videos ([main Actor output and schema](https://apify.com/compass/crawler-google-places)).

### Suggested initial input

Use a bounded request. Do not enable contact enrichment, lead enrichment, social-profile enrichment, questions, web results, or competitor analysis.

```json
{
  "startUrls": [
    {
      "url": "https://www.google.com/maps/place/..."
    }
  ],
  "language": "es",
  "scrapePlaceDetailPage": true,
  "maxReviews": 5,
  "reviewsSort": "mostRelevant",
  "reviewsOrigin": "google",
  "scrapeReviewsPersonalData": true,
  "maxImages": 10,
  "scrapeImageAuthors": true,
  "maxQuestions": 0,
  "scrapeContacts": false,
  "maximumLeadsEnrichmentRecords": 0
}
```

`scrapeReviewsPersonalData: true` supplies the author fields required by Limon's current `RestaurantReview` model and public review cards. The POC should verify that coverage. Production should set it to `false` if reviewer names, profile URLs, and photos are not actually displayed; `reviewId` remains available for deduplication. If the product keeps attribution enabled, document the relevant privacy basis and removal process. The Actor itself warns that reviewer data can be personal data protected by GDPR and other laws.

## Current pricing

The Store headline says the full Actor starts at [$1.50 per 1,000 places](https://apify.com/compass/crawler-google-places/pricing). That is the discounted base place event, not the cost of a complete Limon import.

The current [Actor API pricing record](https://api.apify.com/v2/actors/compass~crawler-google-places), effective 2026-06-30, lists these rates:

| Event | Free | Starter/Bronze | Scale/Silver | Business/Gold |
| --- | ---: | ---: | ---: | ---: |
| Place scraped | $0.00400 | $0.00300 | $0.00200 | $0.00150 |
| Additional place details | $0.00200 | $0.00200 | $0.00150 | $0.00105 |
| Each review | $0.00050 | $0.00050 | $0.00037 | $0.00026 |
| Each image | $0.00050 | $0.00050 | $0.00037 | $0.00026 |
| Actor start, per configured GB | $0.00005 | $0.00005 | $0.00005 | $0.00005 |

The Actor's default memory is 4 GB, so a separate run for one restaurant adds about $0.0002. The recommended import with one place, detail extraction, five reviews, and ten images is therefore:

```text
$0.0040 place
+ 0.0020 details
+ 0.0025 five reviews
+ 0.0050 ten images
+ 0.0002 4 GB Actor start
= $0.0137 per restaurant on Free
```

Expected data charges if every restaurant is imported in its own run:

| Imports | Free | Starter/Bronze | Scale/Silver | Business/Gold |
| ---: | ---: | ---: | ---: | ---: |
| 1 | $0.0137 | $0.0127 | $0.00925 | $0.00665 |
| 100 | $1.37 | $1.27 | $0.93 | $0.67 |
| 1,000 | $13.70 | $12.70 | $9.25 | $6.65 |
| 10,000 | $137.00 | $127.00 | $92.50 | $66.50 |

Calculations use the 2026-07-14 tier prices and include one 4 GB Actor start per import. They exclude plan subscription fees, post-run storage/API operations, taxes, failed retries, and future price changes. Batching multiple restaurant URLs into one run lowers the tiny start component, but conflicts with Limon's one-user, instant-generation flow.

[Apify plans](https://apify.com/pricing) currently cost/include $0/$5 usage on Free, $29/$29 on Starter (Bronze), $199/$199 on Scale (Silver), and $999/$999 on Business (Gold). Free is blocked until the next cycle after its credit is exhausted; paid plans meter overage. Therefore the cheapest expected monthly cash outlay for the bounded profile is:

| Monthly imports | Cheapest viable plan | Actor usage | Expected cash outlay |
| ---: | --- | ---: | ---: |
| 1 | Free | $0.0137 | **$0**; uses free credit |
| 100 | Free | $1.37 | **$0**; uses free credit |
| 1,000 | Starter | $12.70 | **$29** plan floor; usage is included |
| 10,000 | Starter | $127.00 | **About $127**; $29 included plus about $98 overage |

At the recommended Free configuration, $5 covers about 364 complete one-place runs. The API supports `maxTotalChargeUsd`, so every run should have a cost cap. The Actor's current `minimalMaxTotalChargeUsd` is $0.50; this is a minimum allowed cap value, not a minimum run charge ([live Actor pricing/defaults](https://api.apify.com/v2/actors/compass~crawler-google-places)).

All-review/all-image imports have no fixed price. If `R` reviews and `I` images are actually extracted in one direct-URL run, the approximate charge is:

- Free: `$0.00620 + $0.00050 * (R + I)`.
- Starter/Bronze: `$0.00520 + $0.00050 * (R + I)`.
- Scale/Silver: `$0.00370 + $0.00037 * (R + I)`.

For a concrete high-content example with 500 reviews and 100 images, one import costs about $0.3062 Free, $0.3052 Starter, or $0.2257 Scale. At 1,000 such restaurants the event usage is about $306.20, $305.20, or $225.70 before comparing subscription floors. This is why all-content mode should be a separate opt-in job, never the default website import ([live Store event prices](https://api.apify.com/v2/store?search=google%20maps&limit=20&offset=0)).

The dedicated [Reviews Scraper pricing](https://apify.com/compass/google-maps-reviews-scraper/pricing) starts at $0.0006 per review on Free and becomes useful only if Limon later needs many or all reviews, date filtering, or independent review refreshes.

Alternative pricing does not overcome their feature gaps. The Extractor currently charges $5/$4/$3/$2.10 per 1,000 base places on Free/Starter/Scale/Business plus the detail event; the high-usage Email Extractor uses the same $5/$4/$3/$2.10 base schedule and adds website-contact events; SolidCode currently charges $2.70/$2.60/$2.50/$2.40 per 1,000 rows plus a $0.01 run start, but does not return review text/authors or a complete photo library ([Extractor API pricing](https://api.apify.com/v2/actors/compass~google-maps-extractor), [Email Extractor API pricing](https://api.apify.com/v2/actors/lukaskrivka~google-maps-with-contact-details), [SolidCode API pricing](https://api.apify.com/v2/actors/solidcode~google-maps-scraper-2-5-per-1-000-results)).

## Reliability and maintenance

The [Actor API record](https://api.apify.com/v2/actors/compass~crawler-google-places) showed the following on 2026-07-14:

- Created in 2018 and not deprecated.
- 508,587 total users and 33,431 users in the previous 30 days.
- 4.76/5 from 1,622 reviews.
- A Store success rate of 96.5%.
- A build published on 2026-07-13 and thousands of historical builds.
- Source code hidden, `LIMITED_PERMISSIONS`, and labeled as maintained by Apify/Compass.

These are strong vendor-maintenance signals, not an SLA. Apify's Actor Terms reserve update/discontinuation rights and otherwise disclaim uninterrupted, timely, accurate, or reliable output. The Actor documentation says Maps results can fluctuate and review/image extraction slows a run. No official source gives a reliable single-place p50/p95 latency, so it must be measured ([Apify Actor Terms, sections 5 and 8](https://docs.apify.com/legal/actor-terms-and-conditions), [main Actor FAQ/input](https://apify.com/compass/crawler-google-places)).

The dedicated Reviews Scraper has stronger task-specific run signals: 47,131 total users, 4.83/5, and a 99.9% Store success rate. It is a sensible fallback for review refresh jobs, not the initial importer.

## API integration

Apify provides an official [`apify-client`](https://docs.apify.com/api/client/js/reference/class/ActorClient) package for TypeScript. `ActorClient.call()` starts a run and polls until completion; `start()` returns immediately. The raw API has equivalent endpoints. Use the canonical `/v2/actors/` prefix; Apify's 2026 API reference marks the older `/v2/acts/` prefix as deprecated but still functional.

- `POST /v2/actors/compass~crawler-google-places/runs` starts asynchronously.
- `POST /v2/actors/compass~crawler-google-places/run-sync-get-dataset-items` waits and returns dataset items, but the synchronous endpoint times out after 300 seconds ([endpoint docs](https://docs.apify.com/api/v2/act-run-sync-get-dataset-items-post)).
- A run returns `defaultDatasetId`; dataset items can then be fetched separately.
- Webhooks support `ACTOR.RUN.SUCCEEDED`, `FAILED`, `ABORTED`, and `TIMED_OUT`. The event contains `actorRunId`, which can be used to fetch the run dataset. See [webhook events](https://docs.apify.com/integrations/webhooks/events).

Use the token only on the server and send it as `Authorization: Bearer ...`; do not put it in query strings, browser code, generated URLs, or logs.

Apify webhooks POST JSON, retry non-2xx responses 11 times with exponential backoff over roughly 32 hours, may occasionally deliver twice, and time out after 30 seconds. Authenticate them with a secret, return quickly, enqueue ingestion, and make processing idempotent on `actorRunId` ([webhook action docs](https://docs.apify.com/integrations/webhooks/actions)).

Apify's published maximum concurrent Actor runs are 25 on Free, 32 on Starter, 128 on Scale, and 256 on Business. The API allows 400 run-start requests per second per Actor and defaults to 60 requests per second per resource for most other operations. These ceilings are above POC load, but Limon still needs a bounded queue so a spike cannot exhaust concurrency or budget. The official client transparently retries `429` responses with exponential backoff ([Apify pricing/plan limits](https://apify.com/pricing), [API rate limiting](https://docs.apify.com/api/v2#rate-limiting)).

### Recommended Limon flow

1. Validate and normalize the submitted Google Maps URL, resolving Google-owned short links to their canonical destination.
2. Persist an idempotent import job and redirect to a processing page without waiting for Apify.
3. Optionally use the current preview importer only for a low-confidence immediate shell; do not let it overwrite later owner edits.
4. Start the Apify Actor asynchronously with one direct URL and a per-run cost cap.
5. Store `actorRunId`, attempt count, input hash, and importer version on the restaurant record.
6. On an authenticated Apify webhook, fetch the dataset server-side and validate it at Limon's provider boundary.
7. Require exactly one matching place; compare `placeId`, `cid`, coordinates, normalized name, and source URL before merging.
8. Merge non-empty fields according to explicit source precedence, preserving owner-edited values.
9. Copy selected assets to storage only if the product has established a right to retain and publish them; otherwise keep source URLs and treat them as replaceable.
10. Mark the import `ready`, `partial`, or `failed`; retry one transient Apify failure with backoff. If Apify fails or returns zero/mismatched places, use the existing Places API path for core data and limited reviews/photos, then the preview parser as the final visibly degraded fallback. Ask the user to correct missing facts instead of silently inventing them.

Do not expose the raw Actor object throughout the app. Map it once into Limon's existing `Restaurant` model so Actor field changes remain isolated, just like the current undocumented Google parser.

The current `fetchMapsDocument()` already follows Google short-link redirects and validates the final URL. Reuse that canonical URL for the Apify request rather than sending the original share link. Extend `Restaurant.importedWith` for Apify, and map `title`, `categoryName`, `location`, `totalScore`, `reviewsCount`, `openingHours`, `images`, and `reviews` at the provider boundary.

### Sync versus async

For a throwaway demo, `run-sync-get-dataset-items` is the smallest integration. For the intended product, asynchronous runs are safer because Vercel/Next.js request limits and Actor cold starts can make an otherwise successful scrape look like a failed form submission. A page-level processing state also lets the existing preview payload satisfy the "instant" promise.

Dataset storage should be treated as transport, not Limon's database. Apify says named storage is retained indefinitely, while unnamed retention depends on plan; on Free, the ten most recent runs are retained for four months. It also notes that reads of an unrestricted storage can work from its hard-to-guess ID alone. Set resources restricted, ingest only required fields, delete each run dataset after successful ingestion, and persist the normalized result in Limon's own durable store ([storage access and retention](https://docs.apify.com/storage#data-retention)).

## Legal and data handling

This is the decisive caveat.

Under the [Apify General Terms](https://docs.apify.com/legal/general-terms-and-conditions):

- Limon is solely responsible for the legality, accuracy, quality, appropriateness, and use of Customer Data.
- Limon must process only data it is authorized to access and in compliance with applicable law.
- If the service extracts from unauthorized sources, the customer is responsible for affected third-party claims and damages.

Under the [Actor Terms](https://docs.apify.com/legal/actor-terms-and-conditions):

- Actors and their output are provided "as is"; Apify disclaims accuracy, reliability, uninterrupted operation, and non-infringement warranties.
- The customer indemnifies Apify for claims arising from Actor use or violation of third-party rights.
- Actor output is treated as Customer Data, but that classification does not grant Limon ownership of Google's database, review text, reviewer identity, or user-uploaded photos.

The main Actor is marked `LIMITED_PERMISSIONS`, so it can access its own storage, generated data, and resources explicitly provided to it, not unrelated account data. Its source is hidden. The Actor Terms grant the creator a processing license for input/output; Apify's General Terms say Limon retains Customer Data rights only to the extent permitted by law and Apify owns Usage Data derived from Actor input, output, Customer Data, and usage patterns ([live Actor record](https://api.apify.com/v2/actors/compass~crawler-google-places), [Actor Terms, sections 3 and 4](https://docs.apify.com/legal/actor-terms-and-conditions), [General Terms, sections 5.8 and 5.9](https://docs.apify.com/legal/general-terms-and-conditions)). These allocations do not manufacture rights in Google or user content.

Apify acts as a processor when it handles personal data on the customer's instructions. The [DPA](https://docs.apify.com/legal/data-processing-addendum) makes Limon responsible for lawful instructions/basis and data-subject compliance, permits international transfers with stated safeguards, and recognizes names, IDs, profiles/contact and location as possible personal data. The full and Reviews Actors can return reviewer names, profile URLs, photos, IDs, and review media, so Limon needs a documented purpose, minimization, privacy notice, retention rules, deletion/correction handling, and takedown route before production. The Actor itself warns not to collect reviewer personal data without a legitimate reason ([main Actor personal-data input](https://apify.com/compass/crawler-google-places/input-schema)).

Google's current [Maps Additional Terms](https://www.google.com/help/terms_maps/) prohibit users or those acting for them from redistributing/selling Maps, copying content except where otherwise permitted, mass downloading/bulk feeds, and using Maps to create or augment certain substitute mapping/listing datasets. Google's [general Terms](https://policies.google.com/terms) also restrict automated access that violates machine-readable instructions and say content belonging to other people or organizations cannot be used without permission or another legal basis. Limon's exact restaurant-site use needs counsel; factual fields, review quotations, photos, attribution, cache duration, and restaurant authorization may have different analyses.

Using Google's official Places API is not automatically a persistence/republication safe harbor. The current Google Maps Platform Terms prohibit exporting/scraping Maps content outside the service, including prefetching, indexing, storing, resharing or rehosting, and specifically list copying/saving business names, addresses, and user reviews, except where service-specific terms expressly permit use/caching ([Google Maps Platform Terms, section 3.2.3](https://cloud.google.com/maps-platform/terms)).

Operationally, Apify is still a valuable abstraction: it owns proxying, browser changes, retries, parsing, run storage, and ongoing Actor maintenance. Contractually, however, it is an infrastructure vendor, not a data licensor or legal shield.

## Live POC result

A paid live run was completed on 2026-07-15 at 04:19 UTC using the Las Palmeras fixture, Actor build `0.14.713`, `maxTotalChargeUsd=0.50`, and the suggested five-review/ten-image input.

| Check | Result |
| --- | --- |
| Run status | `SUCCEEDED` |
| Actor runtime | 10.713 seconds |
| Dataset records | 1 exact place |
| Settled charge | $0.0137 |
| Charged events | 1 place, 1 detail page, 5 reviews, 10 images, 4 GB Actor start |
| Identity | `Cevicheria "Las Palmeras"`, stable `placeId` and `cid` returned |
| Core details | Address, phone, coordinates, 4.0 rating, 60-review count, and seven days of hours returned |
| Reviews | 5/5 returned with text and author attribution; no owner responses were present |
| Images | 10/10 returned with author attribution; listing reported 18 total images |
| Restaurant metadata | 13 amenity/info sections and a table-reservation-provider field returned |
| Missing source fields | Website, description, menu, and owner responses |

The charge settled to the exact estimate after the run completed: `$0.004` place + `$0.002` details + `$0.0025` reviews + `$0.005` images + `$0.0002` Actor start. The initial run response briefly showed only the start charge before event billing settled, so production telemetry should read final cost from the completed run rather than the first terminal-status response.

This validates the field mapping, price formula, and one canonical URL only. It does not establish reliability, p95 latency, short-link behavior, or cross-market coverage.

## Remaining POC test plan

1. Replace or scope the personal token with a restricted server-side integration token for production, and set a hard account spending limit.
2. Preserve the sanitized Las Palmeras output as the first mapping contract fixture.
3. Record end-to-end latency, queue time, run time, actual charge events, output size, and null rates.
4. Verify name, address, phone, coordinates, status, hours, rating, count, five review texts, ten usable images, and stable IDs against the visible listing.
5. Repeat on at least 30 restaurants covering canonical URLs, `maps.app.goo.gl`, `goo.gl/maps`, `cid`, Place ID, encoded/non-Latin names, low-data listings, no website/phone/description, no reviews/photos, closed businesses, 24-hour and split hours, chains/independents, and multiple countries/languages.
6. Run each fixture three times to measure output stability and deduplication behavior.
7. Deliberately submit a search URL, malformed URL, non-restaurant place, removed listing, and redirected link to test rejection and mismatch handling.
8. Measure p50/p95/p99, exact-match rate, field completeness, retries, failed/aborted/timed-out runs, and dollars per successful import. Keep Apify asynchronous regardless; variable all-review/image runs cannot safely define request latency.
9. Stress one restaurant with more than 5,000 reviews and hundreds of photos using `99999`. Test `view=reviews`, duplicate place chunks, exact charged events, output size, cancellation, and the cost cap. Do not enable this mode for normal imports.
10. Simulate duplicate/missing webhooks, webhook non-2xx retries, run failure/timeout, malformed/duplicate dataset rows, deleted dataset, exhausted credit, and concurrency saturation. Require one durable final state per import and no page generated from a mismatched place.
11. Save the actual Actor build number and sanitized output fixture for every contract-test run. Test `latest` before adoption; do not rely indefinitely on an old pinned scraper build because Google UI changes can make it stale.
12. Security-check that tokens never reach browser bundles, URLs, logs, or errors; datasets are restricted/deleted; webhook authentication/idempotency works; and reviewer deletion propagates through Limon storage.
13. Before public/commercial launch, obtain written counsel approval for exact fields, attribution, caching, generated copy, review quotations, image display/rehosting, retention, privacy notice, and restaurant authorization. Recheck Google Terms after 2026-07-30 and all pricing/terms on launch day.

### Acceptance threshold

The POC passes technically only if the 30-place suite achieves at least 95% successful exact imports, **zero wrong-place publications**, stable `placeId` on every success, at least 98% name/address/coordinate coverage, at least 95% phone/website/rating/count/hours coverage when visible on Maps, no uncaught schema changes, and bounded cost/retries. Image URLs must also be tested immediately, after 24 hours, and after seven days; video availability is expected to remain zero.

Passing those thresholds does not reverse the production no-go. Production adoption requires both the technical pass and the legal/privacy/media launch gate. If the legal gate does not pass, restaurant-owned content should be the source of truth and third-party place data should be used only in a form explicitly permitted by the applicable terms.

## Sources

- [Google Maps Scraper README, input, output, API, and current Store pricing](https://apify.com/compass/crawler-google-places)
- [Google Maps Scraper public Actor API record](https://api.apify.com/v2/actors/compass~crawler-google-places)
- [Apify Store search API snapshot](https://api.apify.com/v2/store?search=google%20maps&limit=20&offset=0)
- [Google Maps Extractor README](https://apify.com/compass/google-maps-extractor)
- [Google Maps Reviews Scraper README and schema](https://apify.com/compass/google-maps-reviews-scraper)
- [Google Maps Reviews Scraper public Actor API record](https://api.apify.com/v2/actors/compass~google-maps-reviews-scraper)
- [Google Maps Email Extractor README](https://apify.com/lukaskrivka/google-maps-with-contact-details)
- [SolidCode Google Maps Scraper README](https://apify.com/solidcode/google-maps-scraper-2-5-per-1-000-results)
- [Microworlds Google Maps Scraper README](https://apify.com/microworlds/crawler-google-places)
- [Apify Actor client](https://docs.apify.com/api/client/js/reference/class/ActorClient)
- [Apify API and rate limits](https://docs.apify.com/api/v2)
- [Running Actors](https://docs.apify.com/platform/actors/running)
- [Synchronous Actor dataset endpoint](https://docs.apify.com/api/v2/act-run-sync-get-dataset-items-post)
- [Webhooks](https://docs.apify.com/integrations/webhooks)
- [Webhook delivery behavior](https://docs.apify.com/integrations/webhooks/actions)
- [Datasets](https://docs.apify.com/storage/dataset)
- [Storage access and retention](https://docs.apify.com/storage)
- [Apify pricing](https://apify.com/pricing)
- [Apify General Terms](https://docs.apify.com/legal/general-terms-and-conditions)
- [Apify Actor Terms](https://docs.apify.com/legal/actor-terms-and-conditions)
- [Apify Acceptable Use Policy](https://docs.apify.com/legal/acceptable-use-policy)
- [Apify Data Processing Addendum](https://docs.apify.com/legal/data-processing-addendum)
- [Apify Privacy Policy](https://docs.apify.com/legal/privacy-policy)
- [Google Maps End User Additional Terms](https://www.google.com/help/terms_maps/)
- [Google Terms of Service](https://policies.google.com/terms)
- [Google Maps Platform Terms](https://cloud.google.com/maps-platform/terms)
