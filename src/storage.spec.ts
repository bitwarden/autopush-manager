import { TestBackingStore } from "../spec/test-storage";

import { Storage } from "./storage";

describe("Storage", () => {
  const namespace = "test";
  let storage: Storage<typeof namespace>;
  let baseStorage: TestBackingStore;

  beforeEach(() => {
    baseStorage = new TestBackingStore();
    storage = new Storage(baseStorage, namespace);
  });

  it("writes to the base storage with a namespace", async () => {
    await storage.write("key", "value");

    expect(baseStorage.store.get(`${namespace}:key`)).toEqual(expect.stringContaining("value"));
  });

  it("writes json to the backing store when the value is a JsonValue", async () => {
    await storage.write("key", "value");

    expect(baseStorage.store.get(`${namespace}:key`)).toEqual(JSON.stringify("value"));
  });

  it("writes json to the backing store when the value is a JsonObject", async () => {
    await storage.write("key", { value: "value" });

    expect(baseStorage.store.get(`${namespace}:key`)).toEqual(JSON.stringify({ value: "value" }));
  });

  it("reads from the base storage with a namespace", async () => {
    baseStorage.store.set(`${namespace}:key`, JSON.stringify("value"));

    const result = await storage.read("key");
    expect(result).toEqual("value");
  });

  it("removes from the base storage with a namespace", async () => {
    baseStorage.store.set(`${namespace}:key`, "value");

    await storage.remove("key");

    expect(baseStorage.store.get(`${namespace}:key`)).toBeUndefined();
  });
});
