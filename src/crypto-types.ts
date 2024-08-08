import type { Tagged } from "type-fest";

export type CsprngArray = Tagged<Uint8Array, "CsprngArray">;
export type ECKeyPair = {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  uncompressedPublicKey: UncompressedPublicKey;
};
export type UncompressedPublicKey = Tagged<Uint8Array, "UncompressedPublicKey">;
export type EncodedPrivateKey = Tagged<JsonWebKey, "EncodedPrivateKey">;
export type EncodedUncompressedPublicKey = Tagged<string, "UncompressedPublicKey">;
export type EncodedSymmetricKey = Tagged<string, "EncodedSymmetricKey">;
