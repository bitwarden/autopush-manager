import { TestStorage } from "../spec/test-storage";

import { NamespacedStorage } from "./storage";

describe("NamespacedStorage", () => {
  const namespace = "test";
  let storage: NamespacedStorage<typeof namespace>;
  let baseStorage: TestStorage;

  beforeEach(() => {
    baseStorage = new TestStorage();
    storage = new NamespacedStorage(baseStorage, namespace);
  });

  it("writes to the base storage with a namespace", async () => {
    await storage.write("key", "value");

    expect(baseStorage.store.get(`${namespace}:key`)).toEqual("value");
  });

  it("reads from the base storage with a namespace", async () => {
    baseStorage.store.set(`${namespace}:key`, "value");

    const result = await storage.read("key");
    expect(result).toEqual("value");
  });

  it("removes from the base storage with a namespace", async () => {
    baseStorage.store.set(`${namespace}:key`, "value");

    await storage.remove("key");

    expect(baseStorage.store.get(`${namespace}:key`)).toBeUndefined();
  });
});
