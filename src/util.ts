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
