import { toEqualBuffer } from "./to-equal-buffer";

export * from "./to-equal-buffer";

export function addCustomMatchers() {
  expect.extend({
    toEqualBuffer: toEqualBuffer,
  });
}

export interface CustomMatchers<R = unknown> {
  toEqualBuffer(expected: Uint8Array | ArrayBuffer | ArrayBufferLike): R;
}
