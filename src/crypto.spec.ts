import {
  aesGcmDecrypt,
  ecdhDeriveSharedKey,
  generateEcKeys,
  randomBytes,
  parsePrivateJwk,
  verifyVapidAuth,
  webPushSharedKey,
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
    const keys = await importKeys(
      "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
      "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
    );
    const jwk = await extractPrivateJwk(keys);

    expect(jwk).toEqual({
      kty: "EC",
      crv: "P-256",
      d: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
      ext: true,
      key_ops: ["deriveKey", "deriveBits"],
      x: "JXGyvs3942BVGq8e0PTNNmwRzr5VX4m8t7GGpTM5FzE",
      y: "aOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
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

describe("VerifyVapidAuth", () => {
  it("verifies a valid VAPID auth header", async () => {
    // https://datatracker.ietf.org/doc/html/rfc8292#section-2.4
    const header =
      "vapid t=eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJhdWQiOiJodHRwczovL3B1c2guZXhhbXBsZS5uZXQiLCJleHAiOjE0NTM1MjM3NjgsInN1YiI6Im1haWx0bzpwdXNoQGV4YW1wbGUuY29tIn0.i3CYb7t4xfxCDquptFOepC9GAu_HLGkMlMuCGSK2rpiUfnK9ojFwDXb1JrErtmysazNjjvW2L9OkSSHzvoD1oA, k=BA1Hxzyi1RUM1b5wjxsn7nGxAszw2u61m164i3MrAIxHF6YK5h4SDYic-dRuU_RCPCfA5aq9ojSwk5Y2EmClBPs";
    const publicKey =
      "BA1Hxzyi1RUM1b5wjxsn7nGxAszw2u61m164i3MrAIxHF6YK5h4SDYic-dRuU_RCPCfA5aq9ojSwk5Y2EmClBPs";
    await expect(verifyVapidAuth(header, publicKey)).resolves.toEqual(true);
  });
});

describe("ecdhDeriveSharedKey", () => {
  it("derives a shared key", async () => {
    const publicKey = new Uint8Array([
      4, 212, 7, 72, 118, 252, 190, 220, 245, 154, 52, 177, 252, 15, 23, 133, 156, 239, 180, 143,
      238, 35, 90, 17, 113, 37, 51, 202, 227, 65, 216, 90, 65, 164, 147, 8, 238, 157, 148, 51, 109,
      61, 222, 177, 105, 70, 150, 45, 212, 238, 129, 62, 121, 29, 29, 181, 81, 11, 242, 181, 219,
      56, 159, 236, 125,
    ]);
    const localKeys = await parsePrivateJwk({
      key_ops: ["deriveKey", "deriveBits"],
      ext: true,
      kty: "EC",
      x: "84p2j3B4ulNBhJmjcrIsJl0pax3MaYYk6eqk1HYsN_Y",
      y: "cZCKmCjy4grDsBrGXkpUikHv2VZmen8SRmclj244OtY",
      crv: "P-256",
      d: "EZdq8BiFjHbl6U6F0iK0yF8nXvw8-6mGjto9E_2fpwo",
    });
    if (localKeys === null) {
      fail("localKeys is null");
    }
    const secret = new Uint8Array(16);
    // TODO: convert to string
    const senderKey = fromBufferToUrlB64(publicKey.buffer);
    const salt = fromBufferToUrlB64(secret.buffer); // In practice this is a random value, not linked to secret

    const sharedKeys = await ecdhDeriveSharedKey(localKeys, secret, senderKey, salt);
    expect(sharedKeys.contentEncryptionKey).toEqualBuffer(
      new Uint8Array([48, 0, 223, 95, 172, 79, 172, 31, 184, 11, 61, 5, 68, 120, 86, 62]),
    );
    expect(sharedKeys.nonce).toEqualBuffer(
      new Uint8Array([201, 196, 98, 239, 12, 215, 67, 233, 119, 119, 11, 191]),
    );
  });
});

describe("webPushSharedKey", () => {
  // https://datatracker.ietf.org/doc/html/rfc8291#section-5
  it("recreates the RFC example", async () => {
    const authenticationSecret = "BTBZMqHH6r4Tts7J_aSIgg";
    const receiverKeys = await importKeys(
      "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
      "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
    );
    const senderKeys = await importKeys(
      "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
      "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
    );
    const contentStream =
      "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";
    const result = await webPushSharedKey(
      { keys: receiverKeys, secret: fromUrlB64ToBuffer(authenticationSecret) },
      {
        publicKey: fromBufferToUrlB64(senderKeys.uncompressedPublicKey),
        content: fromUrlB64ToBuffer(contentStream),
      },
    );

    expect(result.contentEncryptionKey).toEqualBuffer(fromUrlB64ToBuffer("oIhVW04MRdy2XN9CiKLxTg"));
    expect(result.nonce).toEqualBuffer(fromUrlB64ToBuffer("4h_95klXJ5E_qnoN"));
  });
});

async function importKeys(b64urlPrivateKey: string, b64urlPublicKey: string) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
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
