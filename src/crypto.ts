import * as crypto from "crypto";

import type { Jsonify } from "type-fest";

import { CsprngArray, ECKeyPair, UncompressedPublicKey } from "./crypto-types";

const subtle = crypto.webcrypto.subtle;

/**
 * Return a buffer filled with random bytes generated from a cryptographically secure random number generator
 */
export function randomBytes(size: number): Promise<CsprngArray> {
  return new Promise<CsprngArray>((resolve, reject) => {
    crypto.randomBytes(size, (error, bytes) => {
      if (error != null) {
        reject(error);
      } else {
        resolve(new Uint8Array(bytes) as CsprngArray);
      }
    });
  });
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
  const dataBuffer = Buffer.from(data.slice(0, data.byteLength - 16));
  const authTag = Buffer.from(data.slice(data.byteLength - 16));
  const cryptoKey = crypto.createSecretKey(Buffer.from(key));
  const cipher = crypto.createDecipheriv("aes-128-gcm", cryptoKey, Buffer.from(iv));
  cipher.setAuthTag(authTag);
  const decrypted = cipher.update(dataBuffer);
  cipher.final();
  return decrypted;
}

export function removePadding(data: Uint8Array, isLastRecord: boolean = true) {
  if (data.findIndex((v) => v !== 0) === -1) {
    throw new Error("All zero aes128gcm decrypted content");
  }
  const expectedPaddingByte = isLastRecord ? 2 : 1;
  let paddingIndex;
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i] === 0) {
      continue;
    }
    if (data[i] !== expectedPaddingByte) {
      throw new Error("Incorrect padding byte");
    }
    paddingIndex = i;
    break;
  }
  return data.slice(0, paddingIndex);
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
 * Exports the private key as a jwk. This can be used to create a new key pair with {@link subtle.importKey}
 * @param ecKeys The key pair to export
 */
export async function extractPrivateJwk(ecKeys: ECKeyPair): Promise<JsonWebKey> {
  const privateKey = ecKeys.privateKey as CryptoKey;
  const jwk = await subtle.exportKey("jwk", privateKey);
  return jwk;
}

/**
 * Parses a JsonWebKey, populated with private and public key information (@see {@link extractPrivateJwk}) object into an Elliptic Curve key pair
 * @param jwk: The JsonWebKey object to parse
 * @returns the Elliptic curve key pair, or null if jwk is null
 *
 * @throws If the key is found but cannot be used to create a valid key pair
 */
export async function parsePrivateJwk(jwk: Jsonify<JsonWebKey> | null): Promise<ECKeyPair | null> {
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
 * Derives a shared secret following RFC-8291 and RFC-8188
 * https://datatracker.ietf.org/doc/html/rfc8291
 * https://datatracker.ietf.org/doc/html/rfc8188
 *
 * @param userAgentData Local EC key pair and secret
 * @param userAgentData.keys Local EC key pair
 * @param userAgentData.secret Secret shared with the remote server
 * @param serverData The server's public key and encrypted content
 * @param content The encrypted content stream. This stream should include the salt, record size, server public key, and encrypted content
 * @returns The derived content encryption key and nonce
 */
export async function webPushDecryptPrep(
  userAgentData: {
    keys: ECKeyPair;
    secret: ArrayBuffer;
  },
  content: ArrayBuffer,
): Promise<{
  contentEncryptionKey: ArrayBuffer;
  nonce: ArrayBuffer;
  encryptedContent: ArrayBuffer;
}> {
  const header = splitContent(new Uint8Array(content));

  const { contentEncryptionKey, nonce } = await deriveKeyAndNonce(
    {
      privateKey: userAgentData.keys.privateKey,
      publicKey: userAgentData.keys.uncompressedPublicKey,
    },
    {
      publicKey: header.serverPublicKey,
    },
    userAgentData.secret,
    header.salt,
  );

  return {
    contentEncryptionKey,
    nonce,
    encryptedContent: header.encryptedContent,
  };
}

/** Derives a content encryption key and nonce for the given set of public/private keys.
 * This function follows the WebPush encryption scheme as defined in RFC-8291.
 *
 * @param userAgentKeys The public and private keys of the user agent
 * @param userAgentKeys.privateKey The private key of the user agent. Optional: One of either userAgentKeys.privateKey or serverKeys.privateKey must be provided
 * @param userAgentKeys.publicKey The public key of the user agent
 * @param serverKeys The public and private keys of the server
 * @param serverKeys.privateKey The private key of the server. Optional: One of either userAgentKeys.privateKey or serverKeys.privateKey must be provided
 * @param serverKeys.publicKey The public key of the server
 * @param secret The shared secret between the user agent and the server
 * @param salt The salt used to derive the content encryption key and nonce
 * @returns The derived content encryption key and nonce
 */
export async function deriveKeyAndNonce(
  userAgentKeys: {
    privateKey?: CryptoKey;
    publicKey: UncompressedPublicKey;
  },
  serverKeys: {
    privateKey?: CryptoKey;
    publicKey: UncompressedPublicKey;
  },
  secret: ArrayBuffer,
  salt: ArrayBuffer,
) {
  const privateKey = userAgentKeys.privateKey ?? serverKeys.privateKey;
  // Use the opposite public key of the private key being used
  const publicKeyUrlB64 =
    privateKey === userAgentKeys.privateKey ? serverKeys.publicKey : userAgentKeys.publicKey;
  if (!privateKey) {
    throw new Error("No private key provided");
  }
  const publicKey = await subtle.importKey(
    "raw",
    publicKeyUrlB64,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );

  const ecdhSecret = await subtle.deriveBits(
    {
      name: "ECDH",
      public: publicKey,
    },
    privateKey as CryptoKey,
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
      info: createInfo("WebPush: info", userAgentKeys.publicKey, serverKeys.publicKey),
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
      salt: salt,
    },
    prkKey,
    128,
  );

  const nonce = await subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      info: createInfo("Content-Encoding: nonce"),
      salt: salt,
    },
    prkKey,
    96,
  );

  return {
    contentEncryptionKey,
    nonce,
  };
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
  serverPublicKey: UncompressedPublicKey;
  encryptedContent: Uint8Array;
} {
  const keyIdSize = new DataView(content.slice(20).buffer).getUint8(0);
  return {
    salt: new Uint8Array(content.slice(0, 16)),
    recordSize: new DataView(content.slice(16, 20).buffer).getUint32(0, false),
    serverPublicKey: new Uint8Array(content.slice(21, 21 + keyIdSize)) as UncompressedPublicKey,
    encryptedContent: new Uint8Array(content.slice(21 + keyIdSize)),
  };
}
