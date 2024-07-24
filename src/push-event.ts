import type { JsonObject } from "type-fest";

export class PushEvent {
  constructor(readonly data: PushMessageData) {}
}

export class PushMessageData {
  constructor(private readonly data: ArrayBuffer) {}

  text(): string {
    return new TextDecoder("utf-8").decode(this.data);
  }

  json(): JsonObject {
    return JSON.parse(this.text());
  }

  arrayBuffer(): ArrayBuffer {
    return this.data;
  }

  blob(): Blob {
    return new Blob([this.data]);
  }

  bytes(): Uint8Array {
    return new Uint8Array(this.data);
  }
}
