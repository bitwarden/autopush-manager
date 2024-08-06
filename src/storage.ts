import type { Constructor, Jsonify, JsonObject, JsonValue } from "type-fest";

import { joinNamespaces, JoinStrings } from "./string-manipulation";

export type PublicStorage = {
  read: ReadCallback;
  write: WriteCallback;
  remove: RemoveCallback;
};

export function deserializerFor<T extends JsonObject>(
  constructor: Constructor<T>,
): (json: Jsonify<T>) => T {
  return (json: Jsonify<T>) => {
    const obj = Object.setPrototypeOf(json, constructor.prototype);
    return obj;
  };
}

export class Storage<const TNamespace extends string = ""> {
  constructor(
    private readonly externalStorage: PublicStorage,
    protected readonly namespace: TNamespace = "" as TNamespace,
  ) {}

  async read<T extends JsonObject | JsonValue>(key: string): Promise<T | null> {
    const json = await this.externalStorage.read<string>(this.getKey(key));
    return this.parse<T>(json);
  }

  async write<T extends JsonObject | JsonValue>(key: string, value: T): Promise<void> {
    const json = this.jsonify(value);
    await this.externalStorage.write(this.getKey(key), json);
  }

  async remove(key: string): Promise<void> {
    return this.externalStorage.remove(this.getKey(key));
  }

  extend<const TNewNamespace extends string>(
    namespace: TNewNamespace,
  ): Storage<JoinStrings<TNamespace, TNewNamespace>> {
    return new Storage(this.externalStorage, joinNamespaces(this.namespace, namespace));
  }

  private jsonify<T extends JsonObject | JsonValue>(value: T): string | null {
    return value == null ? null : JSON.stringify(value);
  }

  private parse<T extends JsonObject | JsonValue>(json: string | null): T | null {
    if (json == null) {
      return null;
    }
    return JSON.parse(json) as T;
  }

  protected getKey(key: string): string {
    return this.namespace === "" ? key : `${this.namespace}:${key}`;
  }
}

export type ReadCallback = <T>(key: string) => Promise<T | null>;
export type WriteCallback = <T>(key: string, value: T) => Promise<void>;
export type RemoveCallback = (key: string) => Promise<void>;
