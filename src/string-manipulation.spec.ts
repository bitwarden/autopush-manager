import { fromB64ToBuffer, fromB64toUrlB64, fromUrlB64ToB64 } from "./string-manipulation";

describe("fromB64toUrlB64", () => {
  it("removes padding", () => {
    expect(fromB64toUrlB64("aGVsbG8gd29ybGQ=")).toBe("aGVsbG8gd29ybGQ");
  });

  it("replaces + with -", () => {
    expect(fromB64toUrlB64("+GVsbG8gd29ybGQ=")).toBe("-GVsbG8gd29ybGQ");
  });

  it("replaces / with _", () => {
    expect(fromB64toUrlB64("/GVsbG8gd29ybGQ=")).toBe("_GVsbG8gd29ybGQ");
  });
});

describe("fromUrlB64ToB64", () => {
  it("adds padding", () => {
    expect(fromUrlB64ToB64("aGVsbG8gd29ybGQ")).toBe("aGVsbG8gd29ybGQ=");
    expect(fromUrlB64ToB64("aGVsbG8gd29ybG")).toBe("aGVsbG8gd29ybG==");
  });

  it("throws on illegal base64url string", () => {
    expect(() => fromUrlB64ToB64("aGVsbG8gd29yb")).toThrowError("Illegal base64url string");
  });

  it("replaces - with +", () => {
    expect(fromUrlB64ToB64("-GVsbG8gd29ybGQ")).toBe("+GVsbG8gd29ybGQ=");
  });

  it("replaces _ with /", () => {
    expect(fromUrlB64ToB64("_GVsbG8gd29ybGQ")).toBe("/GVsbG8gd29ybGQ=");
  });
});
