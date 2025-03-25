import {
  applicationPrivateKey,
  applicationPublicKey,
  applicationPublicKeyX,
  applicationPublicKeyY,
} from "../spec/constants";

import {
  aesGcmDecrypt,
  generateEcKeys,
  randomBytes,
  parsePrivateJwk,
  webPushDecryptPrep,
  extractPrivateJwk,
} from "./crypto";
import { UncompressedPublicKey } from "./crypto-types";
import { fromBufferToUrlB64, fromBufferToUtf8, fromUrlB64ToBuffer } from "./string-manipulation";

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

describe("extractPrivateJwk", () => {
  it("writes EC keys", async () => {
    const keys = await importKeys(applicationPrivateKey, applicationPublicKey);
    const jwk = await extractPrivateJwk(keys);

    expect(jwk).toEqual({
      kty: "EC",
      crv: "P-256",
      d: applicationPrivateKey,
      ext: true,
      key_ops: ["deriveKey", "deriveBits"],
      x: applicationPublicKeyX,
      y: applicationPublicKeyY,
    });
  });
});

describe("parsePrivateJwk", () => {
  it("round trips EC keys", async () => {
    const keys = await generateEcKeys();
    const jwk = await extractPrivateJwk(keys);
    const readKeys = await parsePrivateJwk(jwk);

    if (readKeys === null) {
      fail("readKeys is null");
    }

    expect(readKeys.uncompressedPublicKey).toEqualBuffer(keys.uncompressedPublicKey);
    const readKeysJwk = await extractPrivateJwk(readKeys);
    expect(readKeysJwk).toEqual(jwk);
  });

  it("returns null when jwk is null", async () => {
    const readKeys = await parsePrivateJwk(null);
    expect(readKeys).toBeNull();
  });
});

describe("webPushDecryptPrep", () => {
  // https://datatracker.ietf.org/doc/html/rfc8291#section-5
  it("recreates the RFC example", async () => {
    const authenticationSecret = "BTBZMqHH6r4Tts7J_aSIgg";
    const receiverKeys = await importKeys(applicationPrivateKey, applicationPublicKey);
    const contentStream =
      "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";
    const result = await webPushDecryptPrep(
      { keys: receiverKeys, secret: fromUrlB64ToBuffer(authenticationSecret) },
      fromUrlB64ToBuffer(contentStream),
    );

    expect(result.contentEncryptionKey).toEqualBuffer(fromUrlB64ToBuffer("oIhVW04MRdy2XN9CiKLxTg"));
    expect(result.nonce).toEqualBuffer(fromUrlB64ToBuffer("4h_95klXJ5E_qnoN"));
  });
});

async function importKeys(b64urlPrivateKey: string, b64urlPublicKey: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const subtle = require("crypto").webcrypto.subtle;

  // const priv = fromUrlB64ToBuffer(b64urlPrivateKey)
  const pubPoints = fromUrlB64ToBuffer(b64urlPublicKey);
  const pubX = fromBufferToUrlB64(pubPoints.slice(1, 33));
  const pubY = fromBufferToUrlB64(pubPoints.slice(33, 65));

  const keyData = {
    key_ops: ["deriveKey", "deriveBits"],
    ext: true,
    kty: "EC",
    x: pubX,
    y: pubY,
    crv: "P-256",
    d: b64urlPrivateKey,
  } as JsonWebKey;

  const privateKey = await subtle.importKey(
    "jwk",
    keyData,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey", "deriveBits"],
  );

  // Delete private data from the JWK
  delete keyData.d;
  keyData.key_ops = [];

  const publicKey = await subtle.importKey(
    "jwk",
    keyData,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    [],
  );
  const keys = {
    publicKey,
    privateKey,
  };
  return {
    ...keys,
    uncompressedPublicKey: (await subtle.exportKey("raw", publicKey)) as UncompressedPublicKey,
  };
}
