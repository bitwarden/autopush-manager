import { CsprngArray, ECKeyPair, EncodedPrivateKey, UncompressedPublicKey } from "./crypto-types";
import { Storage } from "./storage";
import { fromUrlB64ToBuffer, fromUtf8ToBuffer } from "./string-manipulation";
import { isNode, _global } from "./util";

let subtle: typeof self.crypto.subtle | typeof import("crypto").webcrypto.subtle;
let webCrypto: typeof self.crypto;
if (!isNode) {
  webCrypto = _global.crypto;
  subtle = webCrypto.subtle;
}

let nodeCrypto: typeof import("crypto");
if (isNode) {
  nodeCrypto = require("crypto");
  subtle = nodeCrypto.webcrypto.subtle;
}

export function randomBytes(size: number): Promise<CsprngArray> {
  if (isNode) {
    return new Promise<CsprngArray>((resolve, reject) => {
      nodeCrypto.randomBytes(size, (error, bytes) => {
        if (error != null) {
          reject(error);
        } else {
          resolve(new Uint8Array(bytes) as CsprngArray);
        }
      });
    });
  } else {
    const array = new Uint8Array(size);
    webCrypto.getRandomValues(array);
    return Promise.resolve(array as CsprngArray);
  }
}

export async function aesGcmDecrypt(
  data: ArrayBuffer,
  key: ArrayBuffer,
  iv: ArrayBuffer,
): Promise<ArrayBuffer> {
  if (isNode) {
    const dataBuffer = Buffer.from(data.slice(0, data.byteLength - 16));
    const authTag = Buffer.from(data.slice(data.byteLength - 16));
    const cryptoKey = nodeCrypto.createSecretKey(Buffer.from(key));
    const cipher = nodeCrypto.createDecipheriv("aes-128-gcm", cryptoKey, Buffer.from(iv));
    cipher.setAuthTag(authTag);
    const decrypted = cipher.update(dataBuffer);
    cipher.final();
    return decrypted;
  } else {
    const impKey = await webCrypto.subtle.importKey("raw", key, { name: "AES-GCM" }, false, [
      "decrypt",
    ]);
    return _global.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: new Uint8Array(0),
        tagLength: 128,
      },
      impKey,
      data,
    ) as Promise<ArrayBuffer>;
  }
}

export async function generateEcKeys(): Promise<ECKeyPair> {
  const keys = await subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey", "deriveBits"],
  );
  return {
    ...keys,
    uncompressedPublicKey: (await subtle.exportKey("raw", keys.publicKey)) as UncompressedPublicKey,
  };
}

export async function writeEcKeys(
  storage: Storage,
  ecKeys: ECKeyPair,
  privateKeyLocation: string,
): Promise<void> {
  const privateKey = ecKeys.privateKey as CryptoKey;
  const jwk = await webCrypto.subtle.exportKey("jwk", privateKey);
  await storage.write(privateKeyLocation, jwk);
}

export async function readEcKeys(
  storage: Storage,
  privateKeyLocation: string,
): Promise<ECKeyPair | null> {
  const jwk = await storage.read<EncodedPrivateKey>(privateKeyLocation);
  if (!jwk) {
    return null;
  }
  const jwkClone = { ...jwk };
  const privateKey = await webCrypto.subtle.importKey(
    "jwk",
    jwkClone,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey", "deriveBits"],
  );

  // Delete private data from the JWK
  delete jwkClone.d;
  jwkClone.key_ops = [];

  const publicKey = await webCrypto.subtle.importKey(
    "jwk",
    jwkClone,
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
    uncompressedPublicKey: (await webCrypto.subtle.exportKey(
      "raw",
      publicKey,
    )) as UncompressedPublicKey,
  };
}

// TODO: handle other auth headers
// - web push
// - non-ec p256 signatures
export async function verifyVapidAuth(
  authHeader: string,
  vapidPublicKey: string,
): Promise<boolean> {
  const parts = authHeader.split(" ");
  if (parts.length !== 3 || parts[0] !== "vapid") {
    return false;
  }

  const t = parts
    .find((p) => p.startsWith("t="))
    ?.split(",")[0]
    .substring(2);
  const k = parts
    .find((p) => p.startsWith("k="))
    ?.split(",")[0]
    .substring(2);

  if (!t || !k || t.length === 0 || k.length === 0 || k !== vapidPublicKey) {
    return false;
  }

  const tParts = t.split(".");

  if (tParts.length !== 3) {
    return false;
  }

  const [header, body, signature] = tParts;
  const unsigned = `${header}.${body}`;

  const result = await ecVerify(unsigned, signature, vapidPublicKey);
  return result;
}

async function ecVerify(data: string, signature: string, publicKey: string): Promise<boolean> {
  const subtle = isNode ? nodeCrypto.webcrypto.subtle : webCrypto.subtle;
  const publicKeyBuffer = fromUrlB64ToBuffer(publicKey);
  const key = await subtle.importKey(
    "raw",
    publicKeyBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  return await subtle.verify(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    key,
    fromUrlB64ToBuffer(signature),
    fromUtf8ToBuffer(data),
  );
  // }
}

export async function ecdhDeriveSharedKey(
  ecKeys: ECKeyPair,
  secret: ArrayBuffer,
  otherPublicKey: string,
  salt: string,
): Promise<{
  contentEncryptionKey: ArrayBuffer;
  nonce: ArrayBuffer;
}> {
  const subtle = isNode ? nodeCrypto.webcrypto.subtle : webCrypto.subtle;
  const recipientPublicKey = ecKeys.uncompressedPublicKey;
  const senderPublicKey = await subtle.importKey(
    "raw",
    fromUrlB64ToBuffer(otherPublicKey),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );

  const derivedSecret = await subtle.deriveBits(
    {
      name: "ECDH",
      public: senderPublicKey,
    },
    ecKeys.privateKey as CryptoKey,
    256,
  );

  const hkdfDerivedSecret = await subtle.importKey("raw", derivedSecret, { name: "HKDF" }, false, [
    "deriveBits",
    "deriveKey",
  ]);

  const prk = await subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: secret,
      info: fromUtf8ToBuffer("Content-Encoding: auth\0"),
    },
    hkdfDerivedSecret,
    256,
  );

  const hdkfPrk = await subtle.importKey("raw", prk, { name: "HKDF" }, false, ["deriveBits"]);

  const contentEncryptionKey = await subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      info: createInfo("aesgcm", recipientPublicKey, fromUrlB64ToBuffer(otherPublicKey)),
      salt: fromUrlB64ToBuffer(salt),
    },
    hdkfPrk,
    // hkdfDerivedSecret,
    128,
  );

  const nonce = await subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      info: createInfo("nonce", recipientPublicKey, fromUrlB64ToBuffer(otherPublicKey)),
      salt: fromUrlB64ToBuffer(salt),
    },
    hdkfPrk,
    // hkdfDerivedSecret,
    96,
  );

  return {
    contentEncryptionKey,
    nonce,
  };
}

function createInfo(
  type: string,
  clientPublicKey: ArrayBuffer,
  serverPublicKey: ArrayBuffer,
): Uint8Array {
  const len = type.length;
  const clientPublicKeyBuffer = new Uint8Array(clientPublicKey);
  const serverPublicKeyBuffer = new Uint8Array(serverPublicKey);

  const info = new Uint8Array(18 + len + 1 + 5 + 1 + 2 + 65 + 2 + 65);

  const encoder = new TextEncoder();
  const typeBuffer = encoder.encode(type);

  // The string 'Content-Encoding: ', as utf-8
  info.set(encoder.encode("Content-Encoding: "));
  // The 'type' of the record, a utf-8 string
  info.set(typeBuffer, 18);
  // A single null-byte
  info.set(encoder.encode("\0"), 18 + len);
  // The string 'P-256', declaring the elliptic curve being used
  info.set(encoder.encode("P-256"), 19 + len);
  // A single null-byte
  info.set(encoder.encode("\0"), 24 + len);
  // The length of the client's public key as a 16-bit integer
  info.set(new Uint16Array([clientPublicKeyBuffer.length]), 25 + len);
  // Now the actual client public key
  info.set(clientPublicKeyBuffer, 27 + len);
  // Length of our public key
  info.set(new Uint16Array([serverPublicKeyBuffer.length]), 92 + len);
  // The key itself
  info.set(serverPublicKeyBuffer, 94 + len);

  return info;
}
