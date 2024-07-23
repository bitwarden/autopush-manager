describe("toEqualBuffer custom matcher", () => {
  it("matches identical ArrayBuffers", () => {
    const array = makeStaticByteArray(10);
    expect(array.buffer).toEqualBuffer(array.buffer);
  });

  it("matches an identical ArrayBuffer and Uint8Array", () => {
    const array = makeStaticByteArray(10);
    expect(array.buffer).toEqualBuffer(array);
  });

  it("doesn't match different ArrayBuffers", () => {
    const array1 = makeStaticByteArray(10);
    const array2 = makeStaticByteArray(10, 11);
    expect(array1.buffer).not.toEqualBuffer(array2.buffer);
  });

  it("doesn't match a different ArrayBuffer and Uint8Array", () => {
    const array1 = makeStaticByteArray(10);
    const array2 = makeStaticByteArray(10, 11);
    expect(array1.buffer).not.toEqualBuffer(array2);
  });
});

function makeStaticByteArray(length: number, start = 0): Uint8Array {
  return new Uint8Array(new Uint8Array(length).map((_, i) => i + start));
}
