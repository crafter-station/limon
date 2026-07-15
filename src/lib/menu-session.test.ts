import { describe, expect, test } from "bun:test";
import { decodeMenuSession, encodeMenuSession } from "./menu-session";

const secret = "a-production-length-secret-value-123456";
const payload = {
  restaurantId: "restaurant-1",
  representativeId: "representative-1",
  expiresAt: 2_000,
};

describe("menu representative sessions", () => {
  test("accepts a valid unexpired signed session", () => {
    const session = encodeMenuSession(payload, secret);
    expect(decodeMenuSession(session, secret, 1_000)).toEqual(payload);
  });

  test("rejects tampered, expired, and incorrectly signed sessions", () => {
    const session = encodeMenuSession(payload, secret);
    expect(
      decodeMenuSession(`${session}tampered`, secret, 1_000),
    ).toBeUndefined();
    expect(
      decodeMenuSession(session, "another-long-secret", 1_000),
    ).toBeUndefined();
    expect(decodeMenuSession(session, secret, 2_001)).toBeUndefined();
  });
});
