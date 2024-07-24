import { Storage } from "../src/storage";

export class TestStorage implements Storage {
  public store: Record<string, unknown> = {};
  async read<T>(key: string): Promise<T | null> {
    return this.store[key] as T | null;
  }

  async write<T>(key: string, value: T): Promise<void> {
    this.store[key] = value;
  }

  async remove(key: string): Promise<void> {
    delete this.store[key];
  }
}
