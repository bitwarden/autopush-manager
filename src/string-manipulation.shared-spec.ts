import {
  fromB64ToBuffer,
  fromBufferToB64,
  fromBufferToUtf8,
  fromUtf8ToBuffer,
  newGuid,
} from "./string-manipulation";

describe("fromBufferToB64", () => {
  it("converts buffer to base64", () => {
    expect(
      fromBufferToB64(new Uint8Array([104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100]).buffer)
    ).toEqual("aGVsbG8gd29ybGQ=");
  });
});

describe("fromB64ToBuffer", () => {
  it("converts base64 to buffer", () => {
    expect(new Uint8Array(fromB64ToBuffer("aGVsbG8gd29ybGQ="))).toEqual(
      new Uint8Array([104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100])
    );
  });
});

describe("fromUtf8ToBuffer", () => {
  it("converts utf8 to buffer", () => {
    expect(new Uint8Array(fromUtf8ToBuffer("hello world"))).toEqual(
      new Uint8Array([104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100])
    );
  });
});

describe("fromBufferToUtf8", () => {
  it("converts buffer to utf8", () => {
    expect(
      fromBufferToUtf8(
        new Uint8Array([104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100]).buffer
      )
    ).toBe("hello world");
  });
});
