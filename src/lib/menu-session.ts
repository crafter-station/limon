import { createHmac, timingSafeEqual } from "node:crypto";

export type MenuSessionPayload = {
  restaurantId: string;
  representativeId: string;
  expiresAt: number;
};

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function encodeMenuSession(payload: MenuSessionPayload, secret: string) {
  const value = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${value}.${sign(value, secret)}`;
}

export function decodeMenuSession(
  value: string,
  secret: string,
  now = Date.now(),
): MenuSessionPayload | undefined {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return undefined;
  const expected = Buffer.from(sign(payload, secret));
  const received = Buffer.from(signature);
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as MenuSessionPayload;
    if (
      !parsed.restaurantId ||
      !parsed.representativeId ||
      parsed.expiresAt <= now
    ) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}
