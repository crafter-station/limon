import "server-only";

import { cookies } from "next/headers";
import {
  consumeVerifiedMenuRepresentative,
  findMenuRepresentativeById,
} from "@/lib/menu-database";
import {
  decodeMenuSession,
  encodeMenuSession,
  type MenuSessionPayload,
} from "@/lib/menu-session";
import { hashRepresentativeToken } from "@/lib/menus";

const COOKIE_NAME = "limon_menu_session";

function sessionSecret() {
  const secret = process.env.MENU_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("MENU_SESSION_SECRET must contain at least 32 characters.");
  }
  return secret;
}

export async function createMenuSession(restaurantId: string, token: string) {
  const secret = sessionSecret();
  const representative = await consumeVerifiedMenuRepresentative(
    restaurantId,
    hashRepresentativeToken(token),
  );
  if (!representative)
    throw new Error("The restaurant access token is invalid.");
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
  const cookieStore = await cookies();
  cookieStore.set(
    COOKIE_NAME,
    encodeMenuSession(
      {
        restaurantId,
        representativeId: representative.id,
        expiresAt,
      } satisfies MenuSessionPayload,
      secret,
    ),
    {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(expiresAt),
    },
  );
  return representative;
}

export async function getMenuRepresentative(restaurantId: string) {
  const cookieStore = await cookies();
  const session = decodeMenuSession(
    cookieStore.get(COOKIE_NAME)?.value ?? "",
    sessionSecret(),
  );
  if (!session || session.restaurantId !== restaurantId) return undefined;
  return findMenuRepresentativeById(restaurantId, session.representativeId);
}

export async function requireMenuRepresentative(restaurantId: string) {
  const representative = await getMenuRepresentative(restaurantId);
  if (!representative) throw new Error("Unauthorized menu operation.");
  return representative;
}

export async function clearMenuSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
