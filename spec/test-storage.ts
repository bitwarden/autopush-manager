import { Storage } from "../src/storage";

export class TestStorage implements Storage {
  store: Map<string, unknown> = new Map();
  async read<T>(key: string): Promise<T | null> {
    return this.store.get(key) as T | null;
  }

  async write<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }
}
