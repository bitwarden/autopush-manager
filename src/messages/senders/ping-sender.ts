import { NamespacedLogger } from "../../logger";
import { ClientPing } from "../message";

import { MessageSender, UnknownDeps } from "./message-sender";

const MIN_PING_DELAY_MS = 1_800_000; // 30 minutes

export class PingSender implements MessageSender<ClientPing, UnknownDeps> {
  private lastPingTime: number | null = null;
  constructor(private readonly logger: NamespacedLogger<"PingSender">) {}

  justPinged() {
    this.lastPingTime = Date.now();
  }

  async buildMessage(): Promise<ClientPing> {
    this.logger.debug("Sending ping");

    if (this.lastPingTime && Date.now() - this.lastPingTime < MIN_PING_DELAY_MS) {
      throw new Error(
        `Ping too soon, minimum delay is ${MIN_PING_DELAY_MS}ms. Wait another ${
          MIN_PING_DELAY_MS - (Date.now() - this.lastPingTime)
        }ms`
      );
    }
    return {
      messageType: "ping",
    };
  }
}
