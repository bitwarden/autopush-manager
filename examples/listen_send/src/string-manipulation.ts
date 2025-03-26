import * as crypto from "crypto";

export type JoinStrings<
  Prefix extends string,
  Suffix extends string,
  Join extends string = ":",
> = `${Prefix}${Join}${Suffix}`;
// export type JoinStrings<
//   Prefix extends string,
//   Suffix extends string,
//   Join extends string = ":",
// > = Prefix extends "" ? Suffix : Suffix extends "" ? Prefix : `${Prefix}${Join}${Suffix}`;
export function joinNamespaces<
  const TPreffix extends string,
  const TSuffix extends string,
  const TJoin extends string,
>(
  prefix: TPreffix,
  suffix: TSuffix,
  join: TJoin = ":" as TJoin,
): JoinStrings<TPreffix, TSuffix, TJoin> {
  if (prefix === "") {
    return suffix as JoinStrings<TPreffix, TSuffix, TJoin>;
  }
  if (suffix === "") {
    return prefix as JoinStrings<TPreffix, TSuffix, TJoin>;
  }
  return `${prefix}${join}${suffix}` as JoinStrings<TPreffix, TSuffix, TJoin>;
}

// ref: http://stackoverflow.com/a/2117523/1090359
export function newUuid<T extends string>(): T {
  return crypto.randomUUID() as T;
}

export function fromBufferToB64(buffer: ArrayBuffer): string {
    return Buffer.from(buffer).toString("base64");
}

export function fromBufferToUrlB64<T extends string = string>(buffer: ArrayBuffer): T {
  return Buffer.from(buffer).toString("base64url") as T;
}

export function fromB64toUrlB64(b64Str: string) {
  return Buffer.from(b64Str, "base64").toString("base64url");
}

export function fromUrlB64ToB64(urlB64Str: string): string {
  return Buffer.from(urlB64Str, "base64url").toString("base64");
}

export function fromUrlB64ToBuffer(urlB64: string): Uint8Array {
  return new Uint8Array(fromB64ToBuffer(fromUrlB64ToB64(urlB64)));
}

export function fromB64ToBuffer(b64: string): Uint8Array {
    return Buffer.from(b64, "base64");
}

export function fromUtf8ToBuffer(str: string): Uint8Array {
    return new Uint8Array(Buffer.from(str, "utf8"));
}

export function fromBufferToUtf8(buffer: ArrayBuffer): string {
    return Buffer.from(buffer).toString("utf8");
}
