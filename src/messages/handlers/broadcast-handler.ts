import { NamespacedLogger } from "../../logger";
import { AutoConnectServerMessage, ServerBroadcast } from "../message";
import { MessageHandler } from "./message-handler";

export class BroadcastHandler implements MessageHandler<ServerBroadcast> {
  constructor(private readonly logger: NamespacedLogger<"BroadcastHandler">) {}

  handlesMessage(message: AutoConnectServerMessage): boolean {
    return message.messageType === "broadcast";
  }

  async handle(message: ServerBroadcast): Promise<void> {
    this.logger.debug("Received broadcast", message);
    // TODO: Implement broadcast handling
  }
}
