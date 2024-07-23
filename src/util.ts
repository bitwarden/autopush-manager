import { Tagged } from "type-fest";
import {
  CsprngArray,
  ECKeyPair,
  EncodedPrivateKey,
  PrivateKey,
  PublicKey,
  UncompressedPublicKey,
} from "./crypto-types";
import { Storage } from "./storage";

export type JoinStrings<
  Prefix extends string,
  Suffix extends string,
  Join extends string = ":"
> = `${Prefix}${Join}${Suffix}`;

const isNode =
  typeof process !== "undefined" && process.versions != null && process.versions.node != null;
const isBrowser = typeof window !== "undefined";
const _global = isNode ? global : isBrowser ? window : self;

let webCrypto: typeof self.crypto;
if (!isNode) {
  webCrypto = _global.crypto;
}

let nodeCrypto: typeof import("crypto");
if (isNode) {
  nodeCrypto = require("crypto");
}

// ref: http://stackoverflow.com/a/2117523/1090359
export type Guid = Tagged<string, "Guid">;
export function newGuid<T extends Guid>(): T {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  }) as T;
}

export function fromBufferToB64(buffer: ArrayBuffer): string {
  if (isNode) {
    return Buffer.from(buffer).toString("base64");
  } else {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return _global.btoa(binary);
  }
}

export function fromBufferToUrlB64<T extends string = string>(buffer: ArrayBuffer): T {
  return fromB64toUrlB64(fromBufferToB64(buffer)) as T;
}

export function fromB64toUrlB64(b64Str: string) {
  return b64Str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function fromUrlB64ToB64(urlB64Str: string): string {
  let output = urlB64Str.replace(/-/g, "+").replace(/_/g, "/");
  switch (output.length % 4) {
    case 0:
      break;
    case 2:
      output += "==";
      break;
    case 3:
      output += "=";
      break;
    default:
      throw new Error("Illegal base64url string!");
  }

  return output;
}

export function fromUrlB64ToBuffer(urlB64: string): ArrayBuffer {
  return fromB64ToBuffer(fromUrlB64ToB64(urlB64));
}

export function fromB64ToBuffer(b64: string): ArrayBuffer {
  if (isNode) {
    return Buffer.from(b64, "base64");
  } else {
    const binary = _global.atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export function fromUtf8ToBuffer(str: string): Uint8Array {
  if (isNode) {
    return new Uint8Array(Buffer.from(str, "utf8"));
  } else {
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }
}

export function fromBufferToUtf8(buffer: ArrayBuffer): string {
  if (isNode) {
    return Buffer.from(buffer).toString("utf8");
  } else {
    const decoder = new TextDecoder();
    return decoder.decode(buffer);
  }
}

export function randomBytes(size: number): Promise<CsprngArray> {
  if (isNode) {
    return new Promise<CsprngArray>((resolve, reject) => {
      nodeCrypto.randomBytes(length, (error, bytes) => {
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
  iv: ArrayBuffer
): Promise<ArrayBuffer> {
  if (isNode) {
    data = Buffer.from(data.slice(0, data.byteLength - 16));
    const authTag = Buffer.from(data.slice(data.byteLength - 16));
    const cryptoKey = nodeCrypto.createSecretKey(new DataView(key));
    const cipher = nodeCrypto.createDecipheriv("aes-256-gcm", cryptoKey, new DataView(iv));
    cipher.setAuthTag(authTag);
    return Buffer.concat([cipher.update(Buffer.from(data)), cipher.final()]);
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
      data
    ) as Promise<ArrayBuffer>;
  }
}

export async function generateEcKeys(): Promise<ECKeyPair> {
  if (isNode) {
    const keyCurve = nodeCrypto.createECDH("prime256v1");
    keyCurve.generateKeys();
    const keys = {
      publicKey: keyCurve.getPublicKey() as PublicKey,
      privateKey: keyCurve.getPrivateKey() as PrivateKey,
    };
    return Promise.resolve({
      ...keys,
      uncompressedPublicKey: keys.publicKey.buffer as UncompressedPublicKey,
    });
  } else {
    const keys = await webCrypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      ["deriveKey"]
    );
    return {
      ...keys,
      uncompressedPublicKey: (await webCrypto.subtle.exportKey(
        "raw",
        keys.publicKey
      )) as UncompressedPublicKey,
    };
  }
}

export async function extractPublicKey(
  keys: Omit<ECKeyPair, "uncompressedPublicKey">
): Promise<UncompressedPublicKey> {
  if (isNode) {
    const keyCurve = nodeCrypto.createECDH("prime256v1");
    keyCurve.setPrivateKey(Buffer.from(keys.privateKey as Uint8Array));
    return keyCurve.getPublicKey().buffer as UncompressedPublicKey;
  } else {
    const keyData = await webCrypto.subtle.exportKey("raw", keys.publicKey as CryptoKey);
    return keyData as UncompressedPublicKey;
  }
}

export async function writeEcKeys(
  storage: Storage,
  ecKeys: ECKeyPair,
  privateKeyLocation: string
): Promise<void> {
  if (isNode) {
    const privateKey = new Uint8Array((ecKeys.privateKey as PrivateKey).buffer);
    await storage.write(privateKeyLocation, privateKey);
  } else {
    const privateKey = ecKeys.privateKey as CryptoKey;
    const jwk = await webCrypto.subtle.exportKey("jwk", privateKey);
    await storage.write(privateKeyLocation, jwk);
  }
}

export async function readEcKeys(
  storage: Storage,
  privateKeyLocation: string
): Promise<ECKeyPair | null> {
  if (isNode) {
    const privateKey = await storage.read<Uint8Array>(privateKeyLocation);
    if (!privateKey) {
      return null;
    }
    const keyCurve = nodeCrypto.createECDH("prime256v1");
    keyCurve.setPrivateKey(Buffer.from(privateKey));
    const keys = {
      publicKey: keyCurve.getPublicKey() as PublicKey,
      privateKey: keyCurve.getPrivateKey() as PrivateKey,
    };
    return {
      ...keys,
      uncompressedPublicKey: keys.publicKey.buffer as UncompressedPublicKey,
    };
  } else {
    const jwk = await storage.read<EncodedPrivateKey>(privateKeyLocation);
    if (!jwk) {
      return null;
    }
    const privateKey = await webCrypto.subtle.importKey(
      "jwk",
      jwk,
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      ["deriveKey"]
    );

    // Delete private data from the JWK
    delete jwk.d;
    jwk.key_ops = ["deriveKey"];

    const publicKey = await webCrypto.subtle.importKey(
      "jwk",
      jwk,
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      ["deriveKey"]
    );
    const keys = {
      publicKey,
      privateKey,
    };
    return {
      ...keys,
      uncompressedPublicKey: (await webCrypto.subtle.exportKey(
        "raw",
        publicKey
      )) as UncompressedPublicKey,
    };
  }
}

// TODO: handle other auth headers
// - web push
// - non-ec p256 signatures
export async function verifyVapidAuth(
  authHeader: string,
  vapidPublicKey: string
): Promise<boolean> {
  const parts = authHeader.split(" ");
  if (parts.length !== 3 || parts[0] !== "vapid") {
    return false;
  }

  const t = parts.find((p) => p.startsWith("t="))?.substring(2);
  const k = parts.find((p) => p.startsWith("k="))?.substring(2);

  if (!t || !k || t.length === 0 || k.length === 0 || k !== vapidPublicKey) {
    return false;
  }

  const tParts = t.split(".");

  if (tParts.length !== 2) {
    return false;
  }

  const [unsigned, signature] = tParts;

  return ecVerify(unsigned, signature, vapidPublicKey);
}

async function ecVerify(data: string, signature: string, publicKey: string): Promise<boolean> {
  if (isNode) {
    const verify = nodeCrypto.createVerify("ecdsa-with-SHA256");
    verify.update(Buffer.from(data, "base64url"));
    const publicKeyBuffer = Buffer.from(publicKey, "base64url");
    const result = verify.verify(publicKeyBuffer, signature, "base64url");
    return Promise.resolve(result);
  } else {
    const publicKeyBuffer = fromUrlB64ToBuffer(publicKey);
    const key = await webCrypto.subtle.importKey(
      "raw",
      publicKeyBuffer,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    return await webCrypto.subtle.verify(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      key,
      fromUrlB64ToBuffer(signature),
      fromUrlB64ToBuffer(data)
    );
  }
}

export async function ecdhDeriveSharedKey(
  ecKeys: ECKeyPair,
  secret: ArrayBuffer,
  otherPublicKey: string,
  salt: string
): Promise<{
  contentEncryptionKey: ArrayBuffer;
  nonce: ArrayBuffer;
}> {
  if (isNode) {
    const recipientPublicKey = (ecKeys.publicKey as PublicKey).buffer;
    const senderPublicKey = fromUrlB64ToBuffer(otherPublicKey);
    const keyCurve = nodeCrypto.createECDH("prime256");
    keyCurve.setPrivateKey(Buffer.from(ecKeys.privateKey as Uint8Array));

    const derivedSecret = keyCurve.computeSecret(otherPublicKey, "base64url", "base64url");
    const prk = Buffer.from(
      nodeCrypto.hkdfSync(
        "sha256",
        derivedSecret,
        Buffer.from(secret),
        fromUtf8ToBuffer("Content-Encoding: auth\0"),
        32
      )
    );
    const contentEncryptionKey = nodeCrypto.hkdfSync(
      "sha256",
      prk,
      salt,
      createInfo("aesgcm", recipientPublicKey, senderPublicKey),
      16
    );
    const nonce = nodeCrypto.hkdfSync(
      "sha256",
      prk,
      salt,
      createInfo("nonce", recipientPublicKey, senderPublicKey),
      12
    );

    return {
      contentEncryptionKey,
      nonce,
    };
  } else {
    const recipientPublicKey = ecKeys.uncompressedPublicKey;
    const senderPublicKey = await webCrypto.subtle.importKey(
      "raw",
      fromUrlB64ToBuffer(otherPublicKey),
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey"]
    );

    const derivedSecret = await webCrypto.subtle.deriveKey(
      {
        name: "ECDH",
        public: senderPublicKey,
      },
      ecKeys.privateKey as CryptoKey,
      { name: "HKDF" },
      false,
      ["deriveKey"]
    );

    const prk = await webCrypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: secret,
        info: fromUtf8ToBuffer("Content-Encoding: auth\0"),
      },
      derivedSecret,
      { name: "HKDF" },
      false,
      ["deriveBits"]
    );

    const contentEncryptionKey = await webCrypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        info: createInfo("aesgcm", recipientPublicKey, fromUrlB64ToBuffer(otherPublicKey)),
        salt: fromUrlB64ToBuffer(salt),
      },
      prk,
      128
    );

    const nonce = await webCrypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        info: createInfo("nonce", recipientPublicKey, fromUrlB64ToBuffer(otherPublicKey)),
        salt: fromUrlB64ToBuffer(salt),
      },
      prk,
      96
    );

    return {
      contentEncryptionKey,
      nonce,
    };
  }
}

function createInfo(type: string, clientPublicKey: ArrayBuffer, serverPublicKey: ArrayBuffer) {
  return isNode
    ? nodeCreateInfo(type, clientPublicKey, serverPublicKey)
    : webCreateInfo(type, clientPublicKey, serverPublicKey);
}

// https://developer.chrome.com/blog/web-push-encryption/#deriving_the_encryption_parameters
function nodeCreateInfo(type: string, clientPublicKey: ArrayBuffer, serverPublicKey: ArrayBuffer) {
  const len = type.length;
  const clientPublicKeyBuffer = Buffer.from(clientPublicKey);
  const serverPublicKeyBuffer = Buffer.from(serverPublicKey);

  // The start index for each element within the buffer is:
  // value               | length | start    |
  // -----------------------------------------
  // 'Content-Encoding: '| 18     | 0        |
  // type                | len    | 18       |
  // nul byte            | 1      | 18 + len |
  // 'P-256'             | 5      | 19 + len |
  // nul byte            | 1      | 24 + len |
  // client key length   | 2      | 25 + len |
  // client key          | 65     | 27 + len |
  // server key length   | 2      | 92 + len |
  // server key          | 65     | 94 + len |
  // For the purposes of push encryption the length of the keys will
  // always be 65 bytes.
  const info = Buffer.alloc(18 + len + 1 + 5 + 1 + 2 + 65 + 2 + 65);

  // The string 'Content-Encoding: ', as utf-8
  info.write("Content-Encoding: ");
  // The 'type' of the record, a utf-8 string
  info.write(type, 18);
  // A single null-byte
  info.write("\0", 18 + len);
  // The string 'P-256', declaring the elliptic curve being used
  info.write("P-256", 19 + len);
  // A single null-byte
  info.write("\0", 24 + len);
  // The length of the client's public key as a 16-bit integer
  info.writeUInt16BE(clientPublicKeyBuffer.length, 25 + len);
  // Now the actual client public key
  clientPublicKeyBuffer.copy(info, 27 + len);
  // Length of our public key
  info.writeUInt16BE(serverPublicKeyBuffer.length, 92 + len);
  // The key itself
  serverPublicKeyBuffer.copy(info, 94 + len);

  return info;
}

function webCreateInfo(type: string, clientPublicKey: ArrayBuffer, serverPublicKey: ArrayBuffer) {
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
