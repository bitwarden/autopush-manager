import { fromB64ToBuffer, fromB64toUrlB64, fromUrlB64ToB64, newGuid } from "./string-manipulation";

describe("newGuid", () => {
  it("returns a new guid", () => {
    expect(newGuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it("creates a new guid each time", () => {
    expect(newGuid()).not.toEqual(newGuid());
  });
});

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
