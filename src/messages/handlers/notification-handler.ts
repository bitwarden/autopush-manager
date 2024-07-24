import { NamespacedLogger } from "../../logger";
import {
  ClientAckCodes,
  ClientAckCode,
  ServerNotification,
  AutoConnectServerMessage,
} from "../message";
import { MessageMediator } from "../message-mediator";

import { MessageHandler } from "./message-handler";

export class NotificationHandler implements MessageHandler<ServerNotification> {
  constructor(
    private readonly mediator: MessageMediator,
    private readonly logger: NamespacedLogger<"NotificationHandler">
  ) {}

  handlesMessage(message: AutoConnectServerMessage): boolean {
    return message.messageType === "notification";
  }

  async handle(message: ServerNotification): Promise<void> {
    this.logger.debug("Received notification", message);

    const sub = this.mediator.subscriptionHandler.get(message.channelId);
    if (!sub) {
      this.logger.error("Received notification for unknown subscription", message);
      // FIXME: Should this be a nack?
      this.mediator.ack({
        channelId: message.channelId,
        version: message.version,
        code: ClientAckCodes.OTHER_FAIL,
      });
      return;
    }

    let code: ClientAckCode = ClientAckCodes.SUCCESS;
    try {
      await sub.handleNotification(message);
    } catch (e) {
      this.logger.error("Error handling notification", e);
      if (typeof e === "number" && Object.values(ClientAckCodes).find((v) => v === e) != null) {
        code = e as ClientAckCode;
      } else {
        code = ClientAckCodes.OTHER_FAIL;
      }
    }

    await this.mediator.ack({
      channelId: message.channelId,
      version: message.version,
      code,
    });

    this.logger.debug("Notification handled", message);
  }
}
