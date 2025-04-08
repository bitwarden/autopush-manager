import type { Tagged } from "type-fest";

import { isNode, _global } from "./util";

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
export type Uuid = Tagged<string, "Uuid">;
export function newUuid<T extends Uuid>(): T {
  return crypto.randomUUID() as T;
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

export function fromUrlB64ToBuffer(urlB64: string): Uint8Array {
  return new Uint8Array(fromB64ToBuffer(fromUrlB64ToB64(urlB64)));
}

export function fromB64ToBuffer(b64: string): Uint8Array {
  if (isNode) {
    return Buffer.from(b64, "base64");
  } else {
    const binary = _global.atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
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
