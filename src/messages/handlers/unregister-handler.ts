import { EventManager } from "../../event-manager";
import { NamespacedLogger } from "../../logger";
import { Guid } from "../../string-manipulation";
import {
  AutoConnectServerMessage,
  ClientUnregisterCode,
  ClientUnregisterCodes,
  ServerUnregister,
} from "../message";
import { MessageMediator } from "../message-mediator";
import { UnregisterSender } from "../senders/unregister-sender";

import { MessageHandler } from "./message-handler";

export class UnregisterHandler implements MessageHandler<ServerUnregister> {
  private readonly unregisteringQueue: Map<Guid, ClientUnregisterCode> = new Map();
  private readonly eventManager: EventManager<{ unregistered: (channelId: Guid) => void }>;
  constructor(
    private readonly mediator: MessageMediator,
    private readonly logger: NamespacedLogger<"UnregisterHandler">
  ) {
    this.eventManager = new EventManager(logger.extend("EventManager"));
  }

  handlesMessage(message: AutoConnectServerMessage): boolean {
    return message.messageType === "unregister";
  }

  expectUnregister(channelId: Guid, code: ClientUnregisterCode) {
    this.logger.debug("Expecting unregister", { channelId, code });
    this.unregisteringQueue.set(channelId, code);

    // If we don't get a registration in 60 seconds, clean up the queue
    setTimeout(() => {
      this.unregisteringQueue.delete(channelId);
    }, 60_000);
  }

  async handle(message: ServerUnregister): Promise<void> {
    this.logger.debug("Received unregister", message);

    switch (message.status) {
      case 200:
        break;
      case 500: {
        // TODO: Implement a backoff strategy
        this.logger.error("Server error on unregister, retrying in 60 seconds", message);

        const code =
          this.unregisteringQueue.get(message.channelId) ?? ClientUnregisterCodes.USER_UNSUBSCRIBED;
        this.unregisteringQueue.delete(message.channelId);

        setTimeout(
          () =>
            this.mediator.send(UnregisterSender, {
              channelId: message.channelId,
              code,
            }),
          60_000
        );
        return;
      }
    }

    // Notify listeners that the channel has been unregistered
    this.eventManager.dispatchEvent("unregistered", message.channelId);

    await this.mediator.subscriptionHandler.removeSubscription(message.channelId);
    this.logger.debug("Unregistered subscription", message);
  }

  async awaitUnregister(channelId: Guid): Promise<void> {
    return new Promise((resolve) => {
      const listener = this.eventManager.addEventListener(
        "unregistered",
        (unregisteredChannelId) => {
          if (unregisteredChannelId === channelId) {
            this.eventManager.removeEventListener("unregistered", listener);
            resolve();
          }
        }
      );
    });
  }
}
