import { NamespacedLogger } from "../../logger";
import { AutoConnectServerMessage, ServerPing } from "../message";

import { MessageHandler } from "./message-handler";

export class PingHandler implements MessageHandler<ServerPing> {
  constructor(private readonly logger: NamespacedLogger<"PingHandler">) {}
  handlesMessage(message: AutoConnectServerMessage): boolean {
    return message.messageType === "ping";
  }

  async handle(message: ServerPing): Promise<void> {
    this.logger.debug("Received ping", message);
  }
}
