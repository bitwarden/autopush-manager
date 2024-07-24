import {
  aesGcmDecrypt,
  ecdhDeriveSharedKey,
  generateEcKeys,
  randomBytes,
  readEcKeys,
  verifyVapidAuth,
  writeEcKeys,
} from "./crypto";
import { fromBufferToUrlB64, fromBufferToUtf8 } from "./string-manipulation";
import { TestStorage } from "../spec/test-storage";

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

describe("generateEcKeys", () => {
  it("generates EC keys", async () => {
    const keys = await generateEcKeys();
    expect((keys.privateKey as CryptoKey).type).toEqual("private");
    expect((keys.publicKey as CryptoKey).type).toEqual("public");
    expect(keys.uncompressedPublicKey.byteLength).toBe(65);
    expect(new Uint8Array(keys.uncompressedPublicKey)[0]).toEqual(0x04);
  });
});

describe("writeEcKeys", () => {
  let storage: TestStorage;

  beforeEach(() => {
    storage = new TestStorage();
  });

  it("writes EC keys", async () => {
    const keys = await generateEcKeys();
    const privateKeyLocation = "test";
    await writeEcKeys(storage, keys, privateKeyLocation);
    const jwk = storage.store[privateKeyLocation] as JsonWebKey;
    expect(jwk.kty).toEqual("EC");
    expect(jwk.crv).toEqual("P-256");
    expect(jwk.d).toEqual(expect.any(String));
    expect(jwk.x).toEqual(expect.any(String));
    expect(jwk.y).toEqual(expect.any(String));
  });
});

describe("readEcKeys", () => {
  it("round trips EC keys", async () => {
    const keys = await generateEcKeys();
    const storage = new TestStorage();
    const privateKeyLocation = "test";
    await writeEcKeys(storage, keys, privateKeyLocation);
    const readKeys = await readEcKeys(storage, privateKeyLocation);

    expect(readKeys).not.toBeNull();

    await writeEcKeys(storage, readKeys!, "test2");

    expect(storage.store["test2"]).toEqualBuffer(storage.store[privateKeyLocation] as any);
  });
});

describe("VerifyVapidAuth", () => {
  it("verifies a valid VAPID auth header", async () => {
    const header =
      "vapid t=eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJhdWQiOiJodHRwczovL2ZjbS5nb29nbGVhcGlzLmNvbS8iLCJleHAiOjE3MjE4MjQwMzAsInN1YiI6Im1haWx0bzp3ZWJwdXNoX29wc0BiaXR3YXJkZW4uY29tIn0.vK7-swmGq2w25HvZRMV1pggxLUx4Zso-0UMD65a6caloZ0f0I09n7kSvDyUUVjNFsUn49BtoMTXlKIRcZXbUfA, k=BPRe7l8uXCrh34pZ56BDqvAR0_c-88U_S8k5IMGBvqrN7-VF6jaZTcEXDZaKjThSZ7qicmeexG66jpY2HdPkCdA";
    const publicKey =
      "BPRe7l8uXCrh34pZ56BDqvAR0_c-88U_S8k5IMGBvqrN7-VF6jaZTcEXDZaKjThSZ7qicmeexG66jpY2HdPkCdA";
    await expect(verifyVapidAuth(header, publicKey)).resolves.toEqual(true);
  });
});

describe("ecdhDeriveSharedKey", () => {
  it("derives a shared key", async () => {
    const storage = new TestStorage();
    storage.store["privateKey"] = {
      key_ops: ["deriveKey", "deriveBits"],
      ext: true,
      kty: "EC",
      x: "84p2j3B4ulNBhJmjcrIsJl0pax3MaYYk6eqk1HYsN_Y",
      y: "cZCKmCjy4grDsBrGXkpUikHv2VZmen8SRmclj244OtY",
      crv: "P-256",
      d: "EZdq8BiFjHbl6U6F0iK0yF8nXvw8-6mGjto9E_2fpwo",
    };
    const publicKey = new Uint8Array([
      4, 212, 7, 72, 118, 252, 190, 220, 245, 154, 52, 177, 252, 15, 23, 133, 156, 239, 180, 143,
      238, 35, 90, 17, 113, 37, 51, 202, 227, 65, 216, 90, 65, 164, 147, 8, 238, 157, 148, 51, 109,
      61, 222, 177, 105, 70, 150, 45, 212, 238, 129, 62, 121, 29, 29, 181, 81, 11, 242, 181, 219,
      56, 159, 236, 125,
    ]);
    const localKeys = (await readEcKeys(storage, "privateKey"))!;
    expect(localKeys).not.toBeNull();
    const secret = new Uint8Array(16);
    // TODO: convert to string
    const senderKey = fromBufferToUrlB64(publicKey.buffer);
    const salt = fromBufferToUrlB64(secret.buffer); // In practice this is a random value, not linked to secret

    const sharedKeys = await ecdhDeriveSharedKey(localKeys, secret, senderKey, salt);
    expect(sharedKeys.contentEncryptionKey).toEqualBuffer(
      new Uint8Array([48, 0, 223, 95, 172, 79, 172, 31, 184, 11, 61, 5, 68, 120, 86, 62])
    );
    expect(sharedKeys.nonce).toEqualBuffer(
      new Uint8Array([201, 196, 98, 239, 12, 215, 67, 233, 119, 119, 11, 191])
    );
  });
});
