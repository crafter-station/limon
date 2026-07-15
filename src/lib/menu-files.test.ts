import { describe, expect, test } from "bun:test";
import {
  assertDevelopmentMalwareScan,
  detectMenuMime,
  MAX_MENU_FILE_BYTES,
  validateMenuFile,
} from "./menu-files";

describe("menu upload validation", () => {
  test("detects type from bytes instead of the extension", () => {
    expect(detectMenuMime(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe(
      "image/jpeg",
    );
    expect(() => detectMenuMime(Buffer.from("<svg><script/></svg>"))).toThrow(
      "static JPEG",
    );
  });

  test("rejects active PDFs", async () => {
    const pdf = new File(
      ["%PDF-1.7\n1 0 obj<</Type /Page /JS 2 0 R>>endobj\n%%EOF"],
      "menu.jpg",
    );
    await expect(validateMenuFile(pdf)).rejects.toThrow("Active or embedded");
  });

  test("rejects oversized files before processing", async () => {
    const file = new File(
      [new Uint8Array(MAX_MENU_FILE_BYTES + 1)],
      "menu.pdf",
    );
    await expect(validateMenuFile(file)).rejects.toThrow("at most 4 MB");
  });

  test("rejects the standard malware test signature", () => {
    expect(() =>
      assertDevelopmentMalwareScan(
        Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE"),
      ),
    ).toThrow("malware scanning");
  });
});
