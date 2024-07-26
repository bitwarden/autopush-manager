import { mock } from "jest-mock-extended";

import { Storage, PublicStorage } from "../src/storage";
import { joinNamespaces, JoinStrings } from "../src/string-manipulation";

export class TestBackingStore implements PublicStorage {
  store: Map<string, unknown> = new Map();
  async read<T>(key: string): Promise<T | null> {
    return Promise.resolve((this.store.get(key) as T) ?? null);
  }

  async write(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
    return Promise.resolve();
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }
}

export class TestStorage<const TNamespace extends string = ""> extends Storage<TNamespace> {
  private constructor(
    private readonly backing: TestBackingStore,
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

  readonly mock = mock<PublicStorage>();
  get store() {
    return this.backing.store;
  }
  override async read<T>(key: string): Promise<T | null> {
    key = this.getKey(key);
    await this.mock.read(key);
    return Promise.resolve(this.backing.store.get(key) as T | null);
  }

  override async write<T>(key: string, value: T): Promise<void> {
    key = this.getKey(key);
    await this.mock.write(key, value);
    this.backing.store.set(key, value);
    return Promise.resolve();
  }

  override async remove(key: string): Promise<void> {
    key = this.getKey(key);
    await this.mock.remove(key);
    this.backing.store.delete(key);
    return Promise.resolve();
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

  setNamespace<const TString extends string>(_: TString): Storage<TString> {
    return this as unknown as Storage<TString>;
  }
}
