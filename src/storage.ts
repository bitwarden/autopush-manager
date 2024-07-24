export type Storage = {
  read: ReadCallback;
  write: WriteCallback;
  remove: RemoveCallback;
};

export type ReadCallback = <T>(key: string) => Promise<T | null>;
export type WriteCallback = <T>(key: string, value: T) => Promise<void>;
export type RemoveCallback = (key: string) => Promise<void>;

export class NamespacedStorage<const TNamespace extends string> implements Storage {
  constructor(
    private readonly storage: Storage,
    private readonly namespace: TNamespace,
  ) {}

  async read<T>(key: string): Promise<T | null> {
    return this.storage.read<T>(this.getKey(key));
  }

  async write<T>(key: string, value: T): Promise<void> {
    return this.storage.write(this.getKey(key), value);
  }

  async remove(key: string): Promise<void> {
    return this.storage.remove(this.getKey(key));
  }

  private getKey(key: string): string {
    return `${this.namespace}:${key}`;
  }
}
