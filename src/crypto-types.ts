import { Tagged } from "type-fest";

export type CsprngArray = Tagged<Uint8Array, "CsprngArray">;
export type ECKeyPair = {
  publicKey: CryptoKey | PublicKey;
  privateKey: CryptoKey | PrivateKey;
  uncompressedPublicKey: UncompressedPublicKey;
};
export type PrivateKey = Tagged<Buffer, "PrivateKey">;
export type PublicKey = Tagged<Buffer, "PublicKey">;
export type UncompressedPublicKey = Tagged<ArrayBuffer, "UncompressedPublicKey">;
export type EncodedPrivateKey = Tagged<JsonWebKey, "EncodedPrivateKey">;
export type EncodedUncompressedPublicKey = Tagged<string, "UncompressedPublicKey">;
export type EncodedSymmetricKey = Tagged<string, "EncodedSymmetricKey">;