import { createHash } from "node:crypto";
import { isIP } from "node:net";

export const REQUIRED_MENU_RIGHTS_SCOPES = [
  "copy",
  "model_process",
  "evaluate",
  "review",
  "retain",
  "derive",
  "publish",
] as const;

export type MenuRightsScope = (typeof REQUIRED_MENU_RIGHTS_SCOPES)[number];
export type MenuVersionStatus =
  | "draft"
  | "needs_review"
  | "approved"
  | "published"
  | "superseded"
  | "revoked";
export type MenuEvidenceDecision = "accepted" | "review_required" | "rejected";

export type MenuEvidence = {
  evidenceId: string;
  fieldPath: string;
  candidateValue: string | null;
  sourceAssetId: string;
  literalText: string;
  coordinateSpace: "normalized_0_1";
  boundingBox: [number, number, number, number];
  ocrConfidence: number | null;
  extractionConfidence: number | null;
  decision: MenuEvidenceDecision;
  source: "extraction" | "owner_correction";
  reviewedAt: string | null;
};

export type MenuPrice = {
  label: string | null;
  amount: string | null;
  currency: string | null;
  amountMinorUnits: number | null;
  evidence: string[];
  reviewedAt: string | null;
};

export type MenuVariant = {
  name: string;
  description: string | null;
  amount: string | null;
  currency: string | null;
  amountMinorUnits: number | null;
  evidence: string[];
  reviewedAt: string | null;
};

export type MenuItem = {
  name: string;
  description: string | null;
  prices: MenuPrice[];
  variants: MenuVariant[];
  allergens: null;
  dietaryClaims: null;
  ingredients: null;
  availability: null;
  evidence: MenuEvidence[];
  ownerEdited: boolean;
};

export type MenuSection = {
  name: string;
  evidence: MenuEvidence[];
  items: MenuItem[];
};

export type MenuPipeline = {
  preprocessorVersion: string;
  ocrProvider: string | null;
  ocrVersion: string | null;
  modelProvider: string;
  modelSnapshot: string;
  promptVersion: string;
  schemaVersion: string;
};

export type MenuSourceAssetSummary = {
  sourceAssetId: string;
  pageIndex: number;
};

export type MenuExtractionInput = {
  menuVersionId: string;
  restaurantId: string;
  sourceAssets: MenuSourceAssetSummary[];
};

export type MenuExtractionResult = {
  sections: MenuSection[];
  pipeline: MenuPipeline;
};

export interface MenuExtractor {
  extract(input: MenuExtractionInput): Promise<MenuExtractionResult>;
}

export const DETERMINISTIC_PIPELINE: MenuPipeline = {
  preprocessorVersion: "limon-image-normalizer/1",
  ocrProvider: null,
  ocrVersion: null,
  modelProvider: "deterministic-fixture",
  modelSnapshot: "empty-safe-v1",
  promptVersion: "menu-extraction-v1",
  schemaVersion: "menu-provenance-v1",
};

export class DeterministicMenuExtractor implements MenuExtractor {
  async extract(): Promise<MenuExtractionResult> {
    // Production model selection is intentionally blocked. An empty draft fails
    // closed and can only be populated by the verified owner review flow.
    return { sections: [], pipeline: DETERMINISTIC_PIPELINE };
  }
}

const STATUS_TRANSITIONS: Record<MenuVersionStatus, MenuVersionStatus[]> = {
  draft: ["needs_review", "revoked"],
  needs_review: ["approved", "revoked"],
  approved: ["published", "revoked"],
  published: ["superseded", "revoked"],
  superseded: ["revoked"],
  revoked: [],
};

export function assertMenuTransition(
  current: MenuVersionStatus,
  next: MenuVersionStatus,
) {
  if (!STATUS_TRANSITIONS[current].includes(next)) {
    throw new Error(`Illegal menu transition: ${current} -> ${next}.`);
  }
}

export function hashRepresentativeToken(token: string) {
  return createHash("sha256").update(`limon-menu:${token}`).digest("hex");
}

export function validateRightsGrant(input: {
  grantorId: string;
  signerAuthority: string;
  ownershipRepresentation: string;
  scopes: string[];
  retentionClass: string;
  deleteAfter: string | null;
}) {
  if (!input.grantorId.trim() || !input.signerAuthority.trim()) {
    throw new Error("The grantor and signer authority are required.");
  }
  if (
    !["creator", "licensee", "authorized_agent", "other"].includes(
      input.ownershipRepresentation,
    )
  ) {
    throw new Error("Select a valid ownership representation.");
  }
  const scopes = new Set(input.scopes);
  if (REQUIRED_MENU_RIGHTS_SCOPES.some((scope) => !scopes.has(scope))) {
    throw new Error("Every required menu rights scope must be granted.");
  }
  if (!["durable_license", "time_limited"].includes(input.retentionClass)) {
    throw new Error("Select a valid retention class.");
  }
  if (
    input.retentionClass === "durable_license" &&
    input.deleteAfter !== null
  ) {
    throw new Error("A durable license cannot have an expiry date.");
  }
  if (input.retentionClass === "time_limited") {
    const deleteAfter = input.deleteAfter
      ? new Date(input.deleteAfter)
      : new Date(Number.NaN);
    if (!Number.isFinite(deleteAfter.getTime()) || deleteAfter <= new Date()) {
      throw new Error("A time-limited grant needs a future deletion date.");
    }
  }
}

const DECIMAL_AMOUNT = /^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/;
const CURRENCY_EXPONENTS: Record<string, number> = {
  ARS: 2,
  BOB: 2,
  BRL: 2,
  CAD: 2,
  CLP: 0,
  COP: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  MXN: 2,
  PEN: 2,
  USD: 2,
  UYU: 2,
};

export function decimalToMinorUnits(amount: string, currency: string) {
  if (!DECIMAL_AMOUNT.test(amount)) throw new Error("Enter a decimal price.");
  const exponent = CURRENCY_EXPONENTS[currency];
  if (exponent === undefined) {
    throw new Error(`Currency ${currency} is not configured for publication.`);
  }
  const [whole, fraction = ""] = amount.split(".");
  if (fraction.length > exponent) {
    throw new Error(`${currency} prices allow ${exponent} decimal places.`);
  }
  return (
    Number(whole) * 10 ** exponent + Number(fraction.padEnd(exponent, "0"))
  );
}

function fieldEvidence(
  path: string,
  value: string,
  sourceAssetId: string,
  reviewedAt: string,
): MenuEvidence {
  return {
    evidenceId: crypto.randomUUID(),
    fieldPath: path,
    candidateValue: value,
    sourceAssetId,
    literalText: value,
    coordinateSpace: "normalized_0_1",
    boundingBox: [0, 0, 1, 1],
    ocrConfidence: null,
    extractionConfidence: null,
    decision: "accepted",
    source: "owner_correction",
    reviewedAt,
  };
}

type ReviewRow = {
  page: number;
  section: string;
  item: string;
  description: string | null;
  priceLabel: string | null;
  amount: string | null;
  currency: string | null;
  variant: string | null;
  variantAmount: string | null;
};

function parseReviewRow(line: string, lineNumber: number): ReviewRow {
  const cells = line.split("\t").map((cell) => cell.trim());
  if (cells.length < 3 || cells.length > 9) {
    throw new Error(
      `Line ${lineNumber} must contain 3 to 9 tab-separated columns.`,
    );
  }
  const page = Number(cells[0]);
  if (!Number.isInteger(page) || page < 1) {
    throw new Error(`Line ${lineNumber} needs a valid page number.`);
  }
  const section = cells[1];
  const item = cells[2];
  if (!section || !item) {
    throw new Error(`Line ${lineNumber} needs a section and item name.`);
  }
  const amount = cells[5] || null;
  const currency = cells[6]?.toUpperCase() || null;
  const variantAmount = cells[8] || null;
  if ((amount === null) !== (currency === null)) {
    throw new Error(
      `Line ${lineNumber} must include both amount and currency.`,
    );
  }
  if (amount && !DECIMAL_AMOUNT.test(amount)) {
    throw new Error(`Line ${lineNumber} has an invalid decimal amount.`);
  }
  if (currency && !/^[A-Z]{3}$/.test(currency)) {
    throw new Error(`Line ${lineNumber} has an invalid ISO-4217 currency.`);
  }
  if (variantAmount && (!cells[7] || !currency)) {
    throw new Error(`Line ${lineNumber} variants need a name and currency.`);
  }
  if (variantAmount && !DECIMAL_AMOUNT.test(variantAmount)) {
    throw new Error(`Line ${lineNumber} has an invalid variant amount.`);
  }
  return {
    page,
    section,
    item,
    description: cells[3] || null,
    priceLabel: cells[4] || null,
    amount,
    currency,
    variant: cells[7] || null,
    variantAmount,
  };
}

export function parseOwnerMenuReview(
  text: string,
  assets: MenuSourceAssetSummary[],
  reviewedAt = new Date().toISOString(),
) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map(parseReviewRow);
  if (rows.length === 0) throw new Error("Add at least one menu item.");
  if (rows.length > 250)
    throw new Error("A menu can contain at most 250 rows.");

  const assetsByPage = new Map(
    assets.map((asset) => [asset.pageIndex + 1, asset]),
  );
  const sections = new Map<string, MenuSection>();
  for (const [index, row] of rows.entries()) {
    const asset = assetsByPage.get(row.page);
    if (!asset) throw new Error(`Line ${index + 1} refers to an unknown page.`);
    let section = sections.get(row.section);
    if (!section) {
      section = {
        name: row.section,
        evidence: [
          fieldEvidence(
            `sections[${sections.size}].name`,
            row.section,
            asset.sourceAssetId,
            reviewedAt,
          ),
        ],
        items: [],
      };
      sections.set(row.section, section);
    }
    const sectionIndex = [...sections.keys()].indexOf(row.section);
    const itemIndex = section.items.length;
    const itemPath = `sections[${sectionIndex}].items[${itemIndex}]`;
    const evidence = [
      fieldEvidence(
        `${itemPath}.name`,
        row.item,
        asset.sourceAssetId,
        reviewedAt,
      ),
    ];
    if (row.description) {
      evidence.push(
        fieldEvidence(
          `${itemPath}.description`,
          row.description,
          asset.sourceAssetId,
          reviewedAt,
        ),
      );
    }
    const prices: MenuPrice[] = [];
    if (row.amount && row.currency) {
      const priceEvidence: MenuEvidence[] = [];
      if (row.priceLabel) {
        priceEvidence.push(
          fieldEvidence(
            `${itemPath}.prices[0].label`,
            row.priceLabel,
            asset.sourceAssetId,
            reviewedAt,
          ),
        );
      }
      const amountEvidence = fieldEvidence(
        `${itemPath}.prices[0].amount`,
        row.amount,
        asset.sourceAssetId,
        reviewedAt,
      );
      const currencyEvidence = fieldEvidence(
        `${itemPath}.prices[0].currency`,
        row.currency,
        asset.sourceAssetId,
        reviewedAt,
      );
      priceEvidence.push(amountEvidence, currencyEvidence);
      evidence.push(...priceEvidence);
      prices.push({
        label: row.priceLabel,
        amount: row.amount,
        currency: row.currency,
        amountMinorUnits: null,
        evidence: priceEvidence.map((entry) => entry.evidenceId),
        reviewedAt,
      });
    }
    const variants: MenuVariant[] = [];
    if (row.variant) {
      const variantEvidence = [
        fieldEvidence(
          `${itemPath}.variants[0].name`,
          row.variant,
          asset.sourceAssetId,
          reviewedAt,
        ),
      ];
      if (row.variantAmount && row.currency) {
        variantEvidence.push(
          fieldEvidence(
            `${itemPath}.variants[0].amount`,
            row.variantAmount,
            asset.sourceAssetId,
            reviewedAt,
          ),
          fieldEvidence(
            `${itemPath}.variants[0].currency`,
            row.currency,
            asset.sourceAssetId,
            reviewedAt,
          ),
        );
      }
      evidence.push(...variantEvidence);
      variants.push({
        name: row.variant,
        description: null,
        amount: row.variantAmount,
        currency: row.variantAmount ? row.currency : null,
        amountMinorUnits: null,
        evidence: variantEvidence.map((entry) => entry.evidenceId),
        reviewedAt: row.variantAmount ? reviewedAt : null,
      });
    }
    section.items.push({
      name: row.item,
      description: row.description,
      prices,
      variants,
      allergens: null,
      dietaryClaims: null,
      ingredients: null,
      availability: null,
      evidence,
      ownerEdited: true,
    });
  }
  return [...sections.values()];
}

export function prepareMenuForApproval(
  sections: MenuSection[],
  validSourceAssetIds: string[],
) {
  validateMenuSections(sections, validSourceAssetIds, true);
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      return {
        ...item,
        prices: item.prices.map((price) => {
          if (!price.reviewedAt)
            throw new Error("Every price requires human review.");
          if (!price.amount || !price.currency) return price;
          return {
            ...price,
            amountMinorUnits: decimalToMinorUnits(price.amount, price.currency),
          };
        }),
        variants: item.variants.map((variant) => {
          if (variant.amount && (!variant.currency || !variant.reviewedAt)) {
            throw new Error("Every variant price requires human review.");
          }
          return {
            ...variant,
            amountMinorUnits:
              variant.amount && variant.currency
                ? decimalToMinorUnits(variant.amount, variant.currency)
                : null,
          };
        }),
      };
    }),
  }));
}

function validateConfidence(value: number | null) {
  return value === null || (Number.isFinite(value) && value >= 0 && value <= 1);
}

function validateMenuSections(
  sections: MenuSection[],
  validSourceAssetIds: string[],
  requireHumanReview: boolean,
) {
  if (
    !Array.isArray(sections) ||
    sections.length === 0 ||
    sections.length > 50 ||
    sections.every((section) => section.items.length === 0)
  ) {
    throw new Error("A menu must contain 1 to 50 non-empty sections.");
  }
  const validAssets = new Set(validSourceAssetIds);
  let itemCount = 0;

  function validateEvidence(entries: MenuEvidence[]) {
    if (!Array.isArray(entries))
      throw new Error("Menu evidence must be an array.");
    for (const entry of entries) {
      const [xMin, yMin, xMax, yMax] = entry.boundingBox ?? [];
      if (
        !entry.evidenceId ||
        !entry.fieldPath ||
        !validAssets.has(entry.sourceAssetId) ||
        !entry.literalText ||
        entry.coordinateSpace !== "normalized_0_1" ||
        ![xMin, yMin, xMax, yMax].every(
          (value) => Number.isFinite(value) && value >= 0 && value <= 1,
        ) ||
        xMin > xMax ||
        yMin > yMax ||
        !validateConfidence(entry.ocrConfidence) ||
        !validateConfidence(entry.extractionConfidence) ||
        (requireHumanReview && entry.decision !== "accepted")
      ) {
        throw new Error("Every menu field needs valid source evidence.");
      }
    }
  }

  function requireField(
    entries: MenuEvidence[],
    path: string,
    value: string | null,
    linkedIds?: Set<string>,
  ) {
    if (value === null) return;
    const match = entries.find(
      (entry) =>
        entry.fieldPath === path &&
        entry.candidateValue === value &&
        (!linkedIds || linkedIds.has(entry.evidenceId)),
    );
    if (!match) throw new Error(`Field ${path} is missing literal evidence.`);
  }

  for (const [sectionIndex, section] of sections.entries()) {
    if (!section.name || !Array.isArray(section.items)) {
      throw new Error("Every menu section needs a name and items.");
    }
    validateEvidence(section.evidence);
    requireField(
      section.evidence,
      `sections[${sectionIndex}].name`,
      section.name,
    );
    for (const [itemIndex, item] of section.items.entries()) {
      itemCount += 1;
      if (!item.name || itemCount > 250) {
        throw new Error("A menu can contain at most 250 named items.");
      }
      if (
        item.allergens !== null ||
        item.dietaryClaims !== null ||
        item.ingredients !== null ||
        item.availability !== null
      ) {
        throw new Error(
          "Unsupported safety and availability assertions must remain null.",
        );
      }
      validateEvidence(item.evidence);
      const itemPath = `sections[${sectionIndex}].items[${itemIndex}]`;
      requireField(item.evidence, `${itemPath}.name`, item.name);
      requireField(item.evidence, `${itemPath}.description`, item.description);
      for (const [priceIndex, price] of item.prices.entries()) {
        const linked = new Set(price.evidence);
        const pricePath = `${itemPath}.prices[${priceIndex}]`;
        requireField(item.evidence, `${pricePath}.label`, price.label, linked);
        requireField(
          item.evidence,
          `${pricePath}.amount`,
          price.amount,
          linked,
        );
        requireField(
          item.evidence,
          `${pricePath}.currency`,
          price.currency,
          linked,
        );
        if (price.amountMinorUnits !== null) {
          throw new Error(
            "Extracted and reviewed prices cannot set minor units early.",
          );
        }
        if (requireHumanReview && !price.reviewedAt) {
          throw new Error("Every price requires human review.");
        }
      }
      for (const [variantIndex, variant] of item.variants.entries()) {
        const linked = new Set(variant.evidence);
        const variantPath = `${itemPath}.variants[${variantIndex}]`;
        requireField(
          item.evidence,
          `${variantPath}.name`,
          variant.name,
          linked,
        );
        requireField(
          item.evidence,
          `${variantPath}.description`,
          variant.description,
          linked,
        );
        requireField(
          item.evidence,
          `${variantPath}.amount`,
          variant.amount,
          linked,
        );
        requireField(
          item.evidence,
          `${variantPath}.currency`,
          variant.currency,
          linked,
        );
        if (variant.amountMinorUnits !== null) {
          throw new Error("Variant minor units cannot be set before approval.");
        }
        if (requireHumanReview && variant.amount && !variant.reviewedAt) {
          throw new Error("Every variant price requires human review.");
        }
      }
    }
  }
}

export function validateMenuExtractionResult(
  result: MenuExtractionResult,
  validSourceAssetIds: string[],
) {
  const pipeline = result?.pipeline;
  if (
    !pipeline ||
    Object.values(pipeline).some(
      (value) => value !== null && (typeof value !== "string" || !value),
    )
  ) {
    throw new Error("The extraction pipeline metadata is invalid.");
  }
  if (result.sections.length === 0) return result;
  for (const section of result.sections) {
    for (const entry of section.evidence) {
      if (entry.source !== "extraction" || entry.reviewedAt !== null) {
        throw new Error("Provider evidence cannot claim an owner review.");
      }
    }
    for (const item of section.items) {
      if (item.ownerEdited) {
        throw new Error("Provider output cannot claim an owner correction.");
      }
      for (const entry of item.evidence) {
        if (entry.source !== "extraction" || entry.reviewedAt !== null) {
          throw new Error("Provider evidence cannot claim an owner review.");
        }
      }
      if (
        item.prices.some((price) => price.reviewedAt !== null) ||
        item.variants.some((variant) => variant.reviewedAt !== null)
      ) {
        throw new Error("Provider prices cannot claim human review.");
      }
    }
  }
  validateMenuSections(result.sections, validSourceAssetIds, false);
  return result;
}

export function mergeExtractionWithOwnerCorrections(
  previous: MenuSection[],
  extracted: MenuSection[],
) {
  const ownerSections = previous.filter((section) =>
    section.items.some((item) => item.ownerEdited),
  );
  if (ownerSections.length === 0) return extracted;
  const names = new Set(
    ownerSections.map((section) => section.name.toLowerCase()),
  );
  return [
    ...ownerSections,
    ...extracted.filter((section) => !names.has(section.name.toLowerCase())),
  ];
}

export function menuSectionsToReviewText(sections: MenuSection[]) {
  const lines: string[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      const page =
        item.evidence.find((entry) => entry.fieldPath.endsWith(".name"))
          ?.sourceAssetId ?? "";
      const price = item.prices[0];
      const variant = item.variants[0];
      lines.push(
        [
          page,
          section.name,
          item.name,
          item.description ?? "",
          price?.label ?? "",
          price?.amount ?? "",
          price?.currency ?? variant?.currency ?? "",
          variant?.name ?? "",
          variant?.amount ?? "",
        ].join("\t"),
      );
    }
  }
  return lines.join("\n");
}

function isPrivateIpv4(ip: string) {
  const parts = ip.split(".").map(Number);
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0
  );
}

export function assertPublicMenuAddress(address: string) {
  const version = isIP(address);
  if (version === 4 && isPrivateIpv4(address)) {
    throw new Error("Private network addresses are not allowed.");
  }
  if (
    version === 6 &&
    (/^(?:::1|::|fe[89ab][0-9a-f]:|fc|fd)/i.test(address) ||
      address.toLowerCase().startsWith("::ffff:127."))
  ) {
    throw new Error("Private network addresses are not allowed.");
  }
}

export function validateRestaurantOwnedUrl(value: string) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error("Only credential-free HTTP(S) URLs are allowed.");
  }
  if (url.hostname === "localhost" || isIP(url.hostname)) {
    assertPublicMenuAddress(url.hostname);
  }
  return url;
}
