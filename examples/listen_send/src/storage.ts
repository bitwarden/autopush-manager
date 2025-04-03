import fs from "fs";

import { StorageInterface } from "autopush-manager";

export class Storage implements StorageInterface {
  private store;
  constructor() {
    if (!fs.existsSync("storage.json")) {
      fs.writeFileSync("storage.json", JSON.stringify([]), "utf8");
    }
    const storedMap = JSON.parse(fs.readFileSync("storage.json", "utf8"));
    this.store = new Map(storedMap);
  }
  async read<T>(key: string): Promise<T> {
    return this.store.get(key) as T;
  }

  async write<T>(key: string, value: T) {
    this.store.set(key, value);
    const toStore = JSON.stringify([...this.store.entries()], null, 2);
    fs.writeFileSync("storage.json", toStore, "utf8");
  }

  async remove(key: string) {
    this.store.delete(key);
    const toStore = JSON.stringify([...this.store.entries()]);
    fs.writeFileSync("storage.json", toStore, "utf8");
  }
}
