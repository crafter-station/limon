import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { neon } from "@neondatabase/serverless";
import {
  DETERMINISTIC_PIPELINE,
  hashRepresentativeToken,
  parseOwnerMenuReview,
  prepareMenuForApproval,
  REQUIRED_MENU_RIGHTS_SCOPES,
} from "./menus";

mock.module("server-only", () => ({}));

const connectionString = process.env.DATABASE_URL;
const integrationTest = connectionString ? describe : describe.skip;
const restaurantId = crypto.randomUUID();
const otherRestaurantId = crypto.randomUUID();
const representativeId = crypto.randomUUID();
const otherRepresentativeId = crypto.randomUUID();
const otherGrantId = crypto.randomUUID();
const accessRepresentativeId = crypto.randomUUID();
const assetId = crypto.randomUUID();
const accessToken = crypto.randomUUID();
const sql = connectionString ? neon(connectionString) : undefined;

integrationTest("durable menu lifecycle", () => {
  beforeAll(async () => {
    if (!sql) return;
    await sql`
      INSERT INTO restaurants (id, source_url, slug, status, data)
      VALUES (
        ${restaurantId}, ${`https://example.test/${restaurantId}`},
        ${`test-${restaurantId}`}, 'ready',
        ${{ name: "Test restaurant" }}::jsonb
      )
    `;
    await sql`
      INSERT INTO restaurants (id, source_url, slug, status, data)
      VALUES (
        ${otherRestaurantId}, ${`https://example.test/${otherRestaurantId}`},
        ${`test-${otherRestaurantId}`}, 'ready',
        ${{ name: "Other restaurant" }}::jsonb
      )
    `;
    await sql`
      INSERT INTO menu_representatives (
        id, restaurant_id, display_name, token_hash
      ) VALUES (
        ${accessRepresentativeId}, ${restaurantId}, 'Access owner',
        ${hashRepresentativeToken(accessToken)}
      )
    `;
    await sql`
      INSERT INTO menu_representatives (
        id, restaurant_id, display_name, token_hash, consumed_at
      ) VALUES (
        ${otherRepresentativeId}, ${otherRestaurantId}, 'Other owner',
        ${crypto.randomUUID()}, NOW()
      )
    `;
    await sql`
      INSERT INTO menu_rights_grants (
        id, restaurant_id, representative_id, grantor_id, signer_authority,
        ownership_representation, scopes, granted_at, retention_class
      ) VALUES (
        ${otherGrantId}, ${otherRestaurantId}, ${otherRepresentativeId},
        'other-grantor', 'Owner', 'creator',
        ${[...REQUIRED_MENU_RIGHTS_SCOPES]}, NOW(), 'durable_license'
      )
    `;
    await sql`
      INSERT INTO menu_representatives (
        id, restaurant_id, display_name, token_hash, consumed_at
      ) VALUES (
        ${representativeId}, ${restaurantId}, 'Integration owner',
        ${crypto.randomUUID()}, NOW()
      )
    `;
  });

  afterAll(async () => {
    if (!sql) return;
    await sql`
      DELETE FROM restaurants WHERE id IN (${restaurantId}, ${otherRestaurantId})
    `;
  });

  test("fences jobs, publishes only approval, unpublishes, and deletes idempotently", async () => {
    if (!sql) return;
    const database = await import("./menu-database");
    const accessAttempts = await Promise.all([
      database.consumeVerifiedMenuRepresentative(
        restaurantId,
        hashRepresentativeToken(accessToken),
      ),
      database.consumeVerifiedMenuRepresentative(
        restaurantId,
        hashRepresentativeToken(accessToken),
      ),
    ]);
    expect(accessAttempts.filter(Boolean)).toHaveLength(1);
    const uploadBatchId = crypto.randomUUID();
    await database.createMenuUploadBatch(
      uploadBatchId,
      restaurantId,
      representativeId,
    );
    const upload = await database.createMenuUpload({
      uploadBatchId,
      restaurantId,
      representativeId,
      grantorId: "integration-grantor",
      signerAuthority: "Owner",
      ownershipRepresentation: "creator",
      scopes: [...REQUIRED_MENU_RIGHTS_SCOPES],
      retentionClass: "durable_license",
      deleteAfter: null,
      pipeline: DETERMINISTIC_PIPELINE,
      assets: [
        {
          id: assetId,
          pageIndex: 0,
          originalName: "menu.png",
          mimeType: "image/png",
          byteSize: 100,
          widthPx: 10,
          heightPx: 10,
          pageCount: 1,
          originalSha256: "a".repeat(64),
          transformedSha256: "b".repeat(64),
          perceptualHash: "0".repeat(16),
          originalBlobUrl: `https://blob.test/${assetId}/original`,
          transformedBlobUrl: `https://blob.test/${assetId}/transformed`,
          transformations: ["test"],
          malwareScanner: "fixture",
          malwareScannerVersion: "1",
        },
      ],
    });

    const lease = await database.claimMenuExtraction(upload.versionId);
    expect(lease).toBeString();
    expect(
      await database.claimMenuExtraction(upload.versionId),
    ).toBeUndefined();
    expect(
      await database.completeMenuExtraction(
        upload.versionId,
        crypto.randomUUID(),
        [],
        DETERMINISTIC_PIPELINE,
      ),
    ).toBeFalse();
    expect(
      await database.completeMenuExtraction(
        upload.versionId,
        lease as string,
        [],
        DETERMINISTIC_PIPELINE,
      ),
    ).toBeTrue();

    const draft = await database.getMenuVersion(upload.versionId);
    const reviewed = parseOwnerMenuReview(
      "1\tEntradas\tCeviche\tPescado\tPersonal\t29.90\tPEN",
      [{ sourceAssetId: assetId, pageIndex: 0 }],
      "2026-07-15T12:00:00.000Z",
    );
    const saved = await database.saveOwnerMenuReview({
      restaurantId,
      versionId: upload.versionId,
      representativeId,
      expectedRevision: draft?.revision ?? -1,
      sections: reviewed,
    });
    await expect(
      database.publishMenuVersion({
        restaurantId,
        versionId: upload.versionId,
        representativeId,
      }),
    ).rejects.toThrow("approved");
    await database.approveMenuVersion({
      restaurantId,
      versionId: upload.versionId,
      representativeId,
      expectedRevision: saved.revision,
      sections: prepareMenuForApproval(reviewed, [assetId]),
    });
    await database.publishMenuVersion({
      restaurantId,
      versionId: upload.versionId,
      representativeId,
    });
    expect(
      await sql`
        SELECT menu_version_id FROM restaurant_menu_publications
        WHERE restaurant_id = ${restaurantId}
      `,
    ).toHaveLength(1);

    await expect(
      database.revokeMenuGrant({
        restaurantId,
        rightsGrantId: otherGrantId,
        representativeId,
      }),
    ).rejects.toThrow("not found");
    expect(
      await sql`
        SELECT id FROM menu_deletion_jobs WHERE rights_grant_id = ${otherGrantId}
      `,
    ).toHaveLength(0);

    await database.revokeMenuGrant({
      restaurantId,
      rightsGrantId: upload.grantId,
      representativeId,
    });
    expect(
      await sql`
        SELECT menu_version_id FROM restaurant_menu_publications
        WHERE restaurant_id = ${restaurantId}
      `,
    ).toHaveLength(0);
    expect(
      await database.getAuthorizedMenuAsset(restaurantId, assetId),
    ).toBeUndefined();

    const claims = await Promise.all([
      database.claimMenuDeletionJob(upload.grantId),
      database.claimMenuDeletionJob(upload.grantId),
    ]);
    const claimed = claims.find(Boolean);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(claimed).toBeDefined();
    expect(
      await database.completeMenuDeletion(
        claimed?.id ?? "",
        upload.grantId,
        crypto.randomUUID(),
      ),
    ).toBeFalse();
    const sourceBeforeCompletion = await sql`
      SELECT original_name FROM menu_source_assets WHERE id = ${assetId}
    `;
    expect(sourceBeforeCompletion?.[0]?.original_name).toBe("menu.png");
    expect(
      await database.completeMenuDeletion(
        claimed?.id ?? "",
        upload.grantId,
        claimed?.leaseToken ?? "",
      ),
    ).toBeTrue();
    expect(
      await database.completeMenuDeletion(
        claimed?.id ?? "",
        upload.grantId,
        claimed?.leaseToken ?? "",
      ),
    ).toBeFalse();
    const grant = await sql`
      SELECT cascade_status FROM menu_rights_grants WHERE id = ${upload.grantId}
    `;
    expect(grant?.[0]?.cascade_status).toBe("complete");
  });
});
