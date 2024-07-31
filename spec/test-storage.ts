import { mock } from "jest-mock-extended";
import type { JsonObject, JsonValue } from "type-fest";

import { Storage, PublicStorage } from "../src/storage";
import { joinNamespaces, JoinStrings } from "../src/string-manipulation";

export class TestBackingStore implements PublicStorage {
  readonly mock = mock<PublicStorage>();
  store: Map<string, unknown> = new Map();
  async read<T>(key: string): Promise<T | null> {
    void this.mock.read(key);
    return Promise.resolve((this.store.get(key) as T) ?? null);
  }

  async write(key: string, value: unknown): Promise<void> {
    void this.mock.write(key, value);
    this.store.set(key, value);
    return Promise.resolve();
  }

  async remove(key: string): Promise<void> {
    void this.mock.remove(key);
    this.store.delete(key);
    return Promise.resolve();
  }
}

export class TestStorage<const TNamespace extends string = ""> extends Storage<TNamespace> {
  private constructor(
    readonly backing: TestBackingStore,
    initialNamespace: TNamespace = "" as TNamespace,
  ) {
    super(backing, initialNamespace);
  }

  static create<const TNamespace extends string = "">(
    initialNamespace: TNamespace = "" as TNamespace,
  ): TestStorage<TNamespace> {
    const backing = new TestBackingStore();
    return new TestStorage(backing, initialNamespace);
  }

  get store() {
    return this.backing.store;
  }
  override async read<T extends JsonObject | JsonValue>(key: string): Promise<T | null> {
    const value = (await super.read(key)) as T | null;
    return Promise.resolve(value);
  }

  override async write<T extends JsonObject | JsonValue>(key: string, value: T): Promise<void> {
    await super.write(key, value);
    return Promise.resolve();
  }

  override async remove(key: string): Promise<void> {
    await super.remove(key);
  }

  override extend<const TNewNamespace extends string>(
    namespace: TNewNamespace,
  ): Storage<JoinStrings<TNamespace, TNewNamespace>> {
    return this.extendMock(namespace);
  }

  extendMock<TNewNamespace extends string>(
    namespace: TNewNamespace,
  ): TestStorage<JoinStrings<TNamespace, TNewNamespace>> {
    return new TestStorage(this.backing, joinNamespaces(this.namespace, namespace));
  }
}
