import type { JsonObject, JsonValue } from "type-fest";

import { toEqualBuffer } from "./to-equal-buffer";
import { toHaveLastReceived, toHaveNthReceived, toHaveReceived } from "./web-socket-received";

export * from "./to-equal-buffer";

export function addCustomMatchers() {
  expect.extend({
    toEqualBuffer: toEqualBuffer,
    toHaveReceived: toHaveReceived,
    toHaveLastReceived: toHaveLastReceived,
    toHaveNthReceived: toHaveNthReceived,
  });
}

export interface CustomMatchers<R = unknown> {
  toEqualBuffer(expected: Uint8Array | ArrayBuffer | ArrayBufferLike): R;
  toHaveReceived(expected: JsonObject | JsonValue): R;
  toHaveLastReceived(expected: JsonObject | JsonValue): R;
  toHaveNthReceived(expected: JsonObject | JsonValue, n: number): R;
}
