"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearMenuSession,
  createMenuSession,
  requireMenuRepresentative,
} from "@/lib/menu-auth";
import {
  approveMenuVersion,
  getMenuAssets,
  getMenuVersion,
  publishMenuVersion,
  revokeMenuGrant,
  saveOwnerMenuReview,
} from "@/lib/menu-database";
import { runNextMenuDeletion } from "@/lib/menu-deletion";
import { generateMenuDraft } from "@/lib/menu-generation";
import { parseOwnerMenuReview, prepareMenuForApproval } from "@/lib/menus";

function managePath(
  restaurantId: string,
  type?: "error" | "message",
  text?: string,
) {
  const base = `/manage/${restaurantId}`;
  return type && text ? `${base}?${type}=${encodeURIComponent(text)}` : base;
}

export async function loginMenuRepresentative(
  restaurantId: string,
  formData: FormData,
) {
  let destination = managePath(restaurantId);
  try {
    const token = String(formData.get("token") ?? "");
    await createMenuSession(restaurantId, token);
  } catch (error) {
    destination = managePath(
      restaurantId,
      "error",
      error instanceof Error ? error.message : "Access failed.",
    );
  }
  redirect(destination);
}

export async function logoutMenuRepresentative(restaurantId: string) {
  await clearMenuSession();
  redirect(managePath(restaurantId));
}

export async function saveMenuReview(restaurantId: string, formData: FormData) {
  let destination = managePath(restaurantId);
  try {
    const representative = await requireMenuRepresentative(restaurantId);
    if (formData.get("sourceReviewed") !== "yes") {
      throw new Error(
        "Confirm that every entered value appears on its linked source page.",
      );
    }
    if (formData.get("pricesReviewed") !== "yes") {
      throw new Error(
        "Confirm that every price was checked against the source.",
      );
    }
    const versionId = String(formData.get("versionId") ?? "");
    const assets = await getMenuAssets(versionId);
    const sections = parseOwnerMenuReview(
      String(formData.get("menuText") ?? ""),
      assets.map((asset) => ({
        sourceAssetId: asset.id,
        pageIndex: asset.pageIndex,
      })),
    );
    await saveOwnerMenuReview({
      restaurantId,
      versionId,
      representativeId: representative.id,
      expectedRevision: Number(formData.get("expectedRevision")),
      sections,
    });
    revalidatePath(managePath(restaurantId));
    destination = managePath(
      restaurantId,
      "message",
      "Draft corrections saved.",
    );
  } catch (error) {
    destination = managePath(
      restaurantId,
      "error",
      error instanceof Error ? error.message : "The review could not be saved.",
    );
  }
  redirect(destination);
}

export async function approveMenu(restaurantId: string, formData: FormData) {
  let destination = managePath(restaurantId);
  try {
    const representative = await requireMenuRepresentative(restaurantId);
    if (formData.get("approve") !== "yes") {
      throw new Error("Explicit approval is required.");
    }
    const versionId = String(formData.get("versionId") ?? "");
    const [assets, version] = await Promise.all([
      getMenuAssets(versionId),
      getMenuVersion(versionId),
    ]);
    if (
      !version ||
      version.restaurantId !== restaurantId ||
      !version.reviewedAt
    ) {
      throw new Error("Save and review the draft before approval.");
    }
    const sections = prepareMenuForApproval(
      version.sections,
      assets.map((asset) => asset.id),
    );
    await approveMenuVersion({
      restaurantId,
      versionId,
      representativeId: representative.id,
      expectedRevision: Number(formData.get("expectedRevision")),
      sections,
    });
    revalidatePath(managePath(restaurantId));
    destination = managePath(
      restaurantId,
      "message",
      "Menu approved and frozen. Publish it when ready.",
    );
  } catch (error) {
    destination = managePath(
      restaurantId,
      "error",
      error instanceof Error
        ? error.message
        : "The menu could not be approved.",
    );
  }
  redirect(destination);
}

export async function publishMenu(restaurantId: string, formData: FormData) {
  let destination = managePath(restaurantId);
  try {
    const representative = await requireMenuRepresentative(restaurantId);
    if (formData.get("publish") !== "yes") {
      throw new Error("Explicit publication confirmation is required.");
    }
    await publishMenuVersion({
      restaurantId,
      versionId: String(formData.get("versionId") ?? ""),
      representativeId: representative.id,
    });
    revalidatePath(managePath(restaurantId));
    destination = managePath(
      restaurantId,
      "message",
      "The approved menu is public.",
    );
  } catch (error) {
    destination = managePath(
      restaurantId,
      "error",
      error instanceof Error
        ? error.message
        : "The menu could not be published.",
    );
  }
  redirect(destination);
}

export async function revokeMenu(restaurantId: string, formData: FormData) {
  let destination = managePath(restaurantId);
  try {
    const representative = await requireMenuRepresentative(restaurantId);
    if (formData.get("revoke") !== "yes") {
      throw new Error("Confirm revocation and governed deletion.");
    }
    await revokeMenuGrant({
      restaurantId,
      rightsGrantId: String(formData.get("rightsGrantId") ?? ""),
      representativeId: representative.id,
    });
    await runNextMenuDeletion(String(formData.get("rightsGrantId") ?? ""));
    revalidatePath(managePath(restaurantId));
    destination = managePath(
      restaurantId,
      "message",
      "The menu was unpublished and its deletion cascade was started.",
    );
  } catch (error) {
    destination = managePath(
      restaurantId,
      "error",
      error instanceof Error ? error.message : "Revocation failed.",
    );
  }
  redirect(destination);
}

export async function retryMenuDeletion(
  restaurantId: string,
  rightsGrantId: string,
) {
  let destination = managePath(restaurantId);
  try {
    await requireMenuRepresentative(restaurantId);
    const completed = await runNextMenuDeletion(rightsGrantId);
    destination = managePath(
      restaurantId,
      "message",
      completed
        ? "Deletion completed."
        : "No deletion completed; it remains queued.",
    );
  } catch (error) {
    destination = managePath(
      restaurantId,
      "error",
      error instanceof Error ? error.message : "Deletion retry failed.",
    );
  }
  redirect(destination);
}

export async function retryMenuExtraction(
  restaurantId: string,
  versionId: string,
) {
  let destination = managePath(restaurantId);
  try {
    await requireMenuRepresentative(restaurantId);
    const version = await getMenuVersion(versionId);
    if (
      !version ||
      version.restaurantId !== restaurantId ||
      version.status !== "draft"
    ) {
      throw new Error("This menu extraction cannot be retried.");
    }
    const result = await generateMenuDraft(versionId);
    destination = managePath(
      restaurantId,
      result?.status === "needs_review" ? "message" : "error",
      result?.status === "needs_review"
        ? "Draft extraction completed."
        : "Extraction remains queued or failed.",
    );
  } catch (error) {
    destination = managePath(
      restaurantId,
      "error",
      error instanceof Error ? error.message : "Extraction retry failed.",
    );
  }
  redirect(destination);
}
