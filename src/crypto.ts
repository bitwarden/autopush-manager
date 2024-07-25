import { CsprngArray, ECKeyPair, EncodedPrivateKey, UncompressedPublicKey } from "./crypto-types";
import { Storage } from "./storage";
import { fromBufferToUrlB64, fromUrlB64ToBuffer, fromUtf8ToBuffer } from "./string-manipulation";
import { isNode, _global } from "./util";

let webCrypto: typeof self.crypto;
let subtle: typeof self.crypto.subtle | typeof import("crypto").webcrypto.subtle;
if (!isNode) {
  webCrypto = _global.crypto;
  subtle = webCrypto.subtle;
}

let nodeCrypto: typeof import("crypto");
if (isNode) {
  nodeCrypto = require("crypto");
  subtle = nodeCrypto.webcrypto.subtle;
}

/**
 * Return a buffer filled with random bytes generated from a cryptographically secure random number generator
 */
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

/**
 * Decrypts a single block of aes-128-gcm encrypted content
 * @param data The encrypted data
 * @param key The key to decrypt with
 * @param iv The initialization vector (nonce) used to encrypt the data
 */
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

/**
 * Creates a new Elliptic Curve key pair using the P-256 curve
 * @returns The new key pair
 */
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

/**
 * Persists the private key of an Elliptic Curve key pair to storage
 * @param storage The storage to write to
 * @param ecKeys The keys to write
 * @param privateKeyLocation The location to write the private key to
 */
export async function writeEcKeys(
  storage: Storage,
  ecKeys: ECKeyPair,
  privateKeyLocation: string,
): Promise<void> {
  const privateKey = ecKeys.privateKey as CryptoKey;
  const jwk = await subtle.exportKey("jwk", privateKey);
  await storage.write(privateKeyLocation, jwk);
}

/**
 * Reads and initialized an Elliptic curve key pair from storage
 * @param storage The storage to read from
 * @param privateKeyLocation The location at which the private key was stored
 * @returns the Elliptic curve key pair, or null if no key was found
 *
 * @throws If the key is found but cannot be used to create a valid key pair
 */
export async function readEcKeys(
  storage: Storage,
  privateKeyLocation: string,
): Promise<ECKeyPair | null> {
  const jwk = await storage.read<EncodedPrivateKey>(privateKeyLocation);
  if (!jwk) {
    return null;
  }
  const jwkClone = { ...jwk };
  const privateKey = await subtle.importKey(
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

  const publicKey = await subtle.importKey(
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
    uncompressedPublicKey: (await subtle.exportKey("raw", publicKey)) as UncompressedPublicKey,
  };
}

/**
 * Verifies a VAPID auth header according to RFC-8292
 * https://datatracker.ietf.org/doc/html/rfc8292
 * Currently only supports EC P-256 signatures in the form of
 * `vapid t=..., k=...`
 *
 * @todo handle earlier drafts of the RFC ()
 *
 * @param authHeader The value of the Authorization header
 * @param vapidPublicKey the public key to verify the signature with
 * @returns true if the signature is valid, false otherwise
 */
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

/**
 * Verifies a signature was signed with the partner private key of the given public key.
 *
 * Uses the ECDSA algorithm with the P-256 curve and SHA-256 hash.
 *
 * @param data data that was signed
 * @param signature signature to verify
 * @param publicKey public key to verify the signature with
 * @returns
 */
async function ecVerify(data: string, signature: string, publicKey: string): Promise<boolean> {
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

/**
 * Derives a shared secret following older versions of RFC-8291 and RFC-8188
 * https://datatracker.ietf.org/doc/html/rfc8291
 * https://datatracker.ietf.org/doc/html/rfc8188
 *
 * @remarks @see {@link webPushSharedKey} for the up-to-date implementation
 *
 * @param ecKeys Local EC key pair
 * @param secret Secret shared with the remote server, used as a salt in deriving a shared prk, which is then expanded into a content encryption key and nonce
 * @param otherPublicKey The remote server's public key
 * @param salt The salt used in the HKDF expansion of the content encryption key and nonce
 * @returns

 * @param userAgentData 
 * @param serverData 
 * @returns 
 */
export async function webPushSharedKey(
  userAgentData: {
    keys: ECKeyPair;
    secret: ArrayBuffer;
  },
  serverData: {
    publicKey: string;
    content: ArrayBuffer;
  },
): Promise<{
  contentEncryptionKey: ArrayBuffer;
  nonce: ArrayBuffer;
  encryptedContent: ArrayBuffer;
}> {
  const header = splitContent(new Uint8Array(serverData.content));
  if (fromBufferToUrlB64(header.serverPublicKey) !== serverData.publicKey) {
    throw new Error("Server Public key mismatch");
  }

  const userAgentPublicKey = userAgentData.keys.uncompressedPublicKey;
  const senderPublicKey = await subtle.importKey(
    "raw",
    fromUrlB64ToBuffer(serverData.publicKey),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );

  const ecdhSecret = await subtle.deriveBits(
    {
      name: "ECDH",
      public: senderPublicKey,
    },
    userAgentData.keys.privateKey as CryptoKey,
    256,
  );

  const ecdhSecretKey = await subtle.importKey("raw", ecdhSecret, { name: "HKDF" }, false, [
    "deriveBits",
    "deriveKey",
  ]);

  const prk = await subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: userAgentData.secret,
      info: createInfo(
        "WebPush: info",
        userAgentPublicKey,
        fromUrlB64ToBuffer(serverData.publicKey),
      ),
    },
    ecdhSecretKey,
    256,
  );

  const prkKey = await subtle.importKey("raw", prk, { name: "HKDF" }, false, ["deriveBits"]);

  const contentEncryptionKey = await subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      info: createInfo("Content-Encoding: aes128gcm"),
      salt: header.salt,
    },
    prkKey,
    128,
  );

  const nonce = await subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      info: createInfo("Content-Encoding: nonce"),
      salt: header.salt,
    },
    prkKey,
    96,
  );

  return {
    contentEncryptionKey,
    nonce,
    encryptedContent: header.encryptedContent,
  };
}

/**
 * Derives a shared secret following older versions of RFC-8291 and RFC-8188 (v4 and V3)
 * https://datatracker.ietf.org/doc/html/draft-ietf-webpush-encryption-04
 * https://datatracker.ietf.org/doc/html/draft-ietf-httpbis-encryption-encoding-03
 *
 * @remarks @see {@link webPushSharedKey} for the up-to-date implementation
 *
 * @param ecKeys Local EC key pair
 * @param secret Secret shared with the remote server, used as a salt in deriving a shared prk, which is then expanded into a content encryption key and nonce
 * @param otherPublicKey The remote server's public key
 * @param salt The salt used in the HKDF expansion of the content encryption key and nonce
 * @returns
 */
export async function ecdhDeriveSharedKey(
  ecKeys: ECKeyPair,
  secret: ArrayBuffer,
  otherPublicKey: string,
  salt: string,
): Promise<{
  contentEncryptionKey: ArrayBuffer;
  nonce: ArrayBuffer;
}> {
  const recipientPublicKey = ecKeys.uncompressedPublicKey;
  const senderPublicKey = await subtle.importKey(
    "raw",
    fromUrlB64ToBuffer(otherPublicKey),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );

  const ecdhSecret = await subtle.deriveBits(
    {
      name: "ECDH",
      public: senderPublicKey,
    },
    ecKeys.privateKey as CryptoKey,
    256,
  );

  const ecdhSecretKey = await subtle.importKey("raw", ecdhSecret, { name: "HKDF" }, false, [
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
    ecdhSecretKey,
    256,
  );

  const prkKey = await subtle.importKey("raw", prk, { name: "HKDF" }, false, ["deriveBits"]);

  const contentEncryptionKey = await subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      info: createInfoV3("aesgcm", recipientPublicKey, fromUrlB64ToBuffer(otherPublicKey)),
      salt: fromUrlB64ToBuffer(salt),
    },
    prkKey,
    // hkdfDerivedSecret,
    128,
  );

  const nonce = await subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      info: createInfoV3("nonce", recipientPublicKey, fromUrlB64ToBuffer(otherPublicKey)),
      salt: fromUrlB64ToBuffer(salt),
    },
    prkKey,
    // hkdfDerivedSecret,
    96,
  );

  return {
    contentEncryptionKey,
    nonce,
  };
}

/**
 * Creates key info for the HKDF key derivation function following RFC-8291 v4, not the final version
 * @param type
 * @param clientPublicKey
 * @param serverPublicKey
 * @returns
 */
function createInfoV3(
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

/**
 * Creates key info for the HKDF key derivation function following RFC-8291
 * @param type
 * @param values
 * @returns
 */
function createInfo(type: string, ...values: ArrayBuffer[]): Uint8Array {
  const typeLength = type.length;
  const valuesLength = values.reduce((acc, v) => acc + v.byteLength, 0);
  const buffers = values.map((v) => new Uint8Array(v));

  const info = new Uint8Array(typeLength + 1 + valuesLength);

  const encoder = new TextEncoder();
  const typeBuffer = encoder.encode(type);

  // The 'type' of the record, a utf-8 string
  info.set(typeBuffer);
  // A single null-byte
  info.set(encoder.encode("\0"), typeLength);
  // The values
  let offset = typeLength + 1;
  for (const buffer of buffers) {
    info.set(buffer, offset);
    offset += buffer.byteLength;
  }

  return info;
}

/**
 * Splits the content stream of a push message according to RFC-8188 and RFC-8291
 *
 * | Salt (16 bytes) | Record Size (4 bytes) | Server Public Key ID Size (1 byte) | Server Public Key ID (65 bytes) | Encrypted Content (max 3993 bytes) |
 *
 * @param content
 * @returns The split content
 */
function splitContent(content: Uint8Array): {
  salt: Uint8Array;
  recordSize: number;
  serverPublicKey: Uint8Array;
  encryptedContent: Uint8Array;
} {
  const keyIdSize = new DataView(content.slice(20).buffer).getUint8(0);
  return {
    salt: new Uint8Array(content.slice(0, 16)),
    recordSize: new DataView(content.slice(16, 20).buffer).getUint32(0, false),
    serverPublicKey: new Uint8Array(content.slice(21, 21 + keyIdSize)),
    encryptedContent: new Uint8Array(content.slice(21 + keyIdSize)),
  };
}
