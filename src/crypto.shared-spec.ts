import { aesGcmDecrypt, randomBytes } from "./crypto";
import { fromBufferToUtf8 } from "./string-manipulation";

describe("randomBytes", () => {
  it("returns a buffer of the specified length", async () => {
    const buffer = await randomBytes(10);
    expect(buffer.length).toBe(10);
  });

  it("returns a buffer of random data", async () => {
    const buffer1 = await randomBytes(10);
    const buffer2 = await randomBytes(10);
    expect(buffer1).not.toEqualBuffer(buffer2);
  });
});

describe("aesGcmDecrypt", () => {
  it("decrypts", async () => {
    const key = new Uint8Array(16); // filled with 0
    const nonce = new Uint8Array(12);
    const encrypted = new Uint8Array([
      119, 237, 169, 186, 104, 152, 35, 150, 249, 60, 26, 86, 88, 100, 30, 34, 94, 60, 151, 235,
    ]);

    const decrypted = await aesGcmDecrypt(encrypted, key, nonce);
    const result = fromBufferToUtf8(decrypted);
    expect(result).toEqual("test");
  });
});
