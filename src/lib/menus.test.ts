import { describe, expect, test } from "bun:test";
import {
  assertMenuTransition,
  assertPublicMenuAddress,
  decimalToMinorUnits,
  type MenuSection,
  mergeExtractionWithOwnerCorrections,
  parseOwnerMenuReview,
  prepareMenuForApproval,
  REQUIRED_MENU_RIGHTS_SCOPES,
  validateMenuExtractionResult,
  validateRestaurantOwnedUrl,
  validateRightsGrant,
} from "./menus";

const assets = [{ sourceAssetId: "asset-1", pageIndex: 0 }];

describe("menu rights and lifecycle", () => {
  test("requires the complete asset-specific rights scope", () => {
    expect(() =>
      validateRightsGrant({
        grantorId: "restaurant-legal-entity",
        signerAuthority: "Owner",
        ownershipRepresentation: "creator",
        scopes: REQUIRED_MENU_RIGHTS_SCOPES.filter(
          (scope) => scope !== "publish",
        ),
        retentionClass: "durable_license",
        deleteAfter: null,
      }),
    ).toThrow("Every required");
  });

  test("requires expiry for time-limited grants", () => {
    expect(() =>
      validateRightsGrant({
        grantorId: "restaurant-legal-entity",
        signerAuthority: "Owner",
        ownershipRepresentation: "creator",
        scopes: [...REQUIRED_MENU_RIGHTS_SCOPES],
        retentionClass: "time_limited",
        deleteAfter: null,
      }),
    ).toThrow("future deletion date");
  });

  test("rejects publication without approval", () => {
    expect(() => assertMenuTransition("needs_review", "published")).toThrow(
      "Illegal menu transition",
    );
    expect(() => assertMenuTransition("approved", "published")).not.toThrow();
  });
});

describe("owner review", () => {
  test("keeps missing assertions null and links fields to an asset", () => {
    const sections = parseOwnerMenuReview("1\tEntradas\tCeviche", assets);
    expect(sections[0].items[0]).toMatchObject({
      description: null,
      prices: [],
      allergens: null,
      dietaryClaims: null,
      ingredients: null,
      availability: null,
    });
    expect(sections[0].items[0].evidence[0].sourceAssetId).toBe("asset-1");
  });

  test("requires amount and currency together", () => {
    expect(() =>
      parseOwnerMenuReview("1\tEntradas\tCeviche\t\t\t29.90", assets),
    ).toThrow("both amount and currency");
  });

  test("converts a reviewed price only after currency is known", () => {
    expect(decimalToMinorUnits("29.90", "PEN")).toBe(2990);
    expect(() => decimalToMinorUnits("29.90", "ZZZ")).toThrow("not configured");
  });

  test("approval verifies evidence and reviewed prices", () => {
    const sections = parseOwnerMenuReview(
      "1\tEntradas\tCeviche\tPescado fresco\tPersonal\t29.90\tPEN",
      assets,
      "2026-07-15T12:00:00.000Z",
    );
    const approved = prepareMenuForApproval(sections, ["asset-1"]);
    expect(approved[0].items[0].prices[0].amountMinorUnits).toBe(2990);
    expect(() => prepareMenuForApproval(sections, ["another-asset"])).toThrow(
      "valid source evidence",
    );
  });

  test("requires evidence for labels, variants, amounts, and currencies", () => {
    const sections = parseOwnerMenuReview(
      "1\tEntradas\tCeviche\t\tPersonal\t29.90\tPEN\tGrande\t39.90",
      assets,
      "2026-07-15T12:00:00.000Z",
    );
    expect(() => prepareMenuForApproval(sections, ["asset-1"])).not.toThrow();
    sections[0].items[0].evidence = sections[0].items[0].evidence.filter(
      (entry) => !entry.fieldPath.endsWith("variants[0].currency"),
    );
    expect(() => prepareMenuForApproval(sections, ["asset-1"])).toThrow(
      "missing literal evidence",
    );
  });

  test("rejects invalid provider output before persistence", () => {
    const sections = parseOwnerMenuReview("1\tEntradas\tCeviche", assets);
    sections[0].items[0].ownerEdited = false;
    for (const entry of [
      ...sections[0].evidence,
      ...sections[0].items[0].evidence,
    ]) {
      entry.source = "extraction";
      entry.reviewedAt = null;
    }
    sections[0].items[0].allergens = ["fish"] as never;
    expect(() =>
      validateMenuExtractionResult(
        {
          sections,
          pipeline: {
            preprocessorVersion: "1",
            ocrProvider: null,
            ocrVersion: null,
            modelProvider: "fixture",
            modelSnapshot: "1",
            promptVersion: "1",
            schemaVersion: "1",
          },
        },
        ["asset-1"],
      ),
    ).toThrow("must remain null");
  });

  test("owner corrections survive another extraction", () => {
    const owner = parseOwnerMenuReview("1\tEntradas\tCeviche", assets);
    const extracted: MenuSection[] = [
      { name: "Postres", evidence: [], items: [] },
    ];
    expect(mergeExtractionWithOwnerCorrections(owner, extracted)).toHaveLength(
      2,
    );
    expect(mergeExtractionWithOwnerCorrections(owner, extracted)[0].name).toBe(
      "Entradas",
    );
  });
});

describe("remote source SSRF boundary", () => {
  test("rejects private, loopback, link-local and metadata addresses", () => {
    for (const address of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "::1"]) {
      expect(() => assertPublicMenuAddress(address)).toThrow("Private network");
    }
    expect(() => validateRestaurantOwnedUrl("file:///tmp/menu.pdf")).toThrow(
      "HTTP(S)",
    );
    expect(() =>
      validateRestaurantOwnedUrl("https://127.0.0.1/menu.pdf"),
    ).toThrow("Private network");
  });
});
