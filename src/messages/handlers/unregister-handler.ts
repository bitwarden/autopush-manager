import { NamespacedLogger } from "../../logger";
import {
  AutoConnectServerMessage,
  ClientUnregisterCode,
  ClientUnregisterCodes,
  ServerUnregister,
} from "../message";
import { UnregisterSender } from "../senders/unregister-sender";
import { MessageMediator } from "../message-mediator";
import { MessageHandler } from "./message-handler";
import { Guid } from "../../util";
import { EventManager } from "../../event-manager";

export class UnregisterHandler implements MessageHandler<ServerUnregister> {
  private readonly unregisteringQueue: Record<Guid, ClientUnregisterCode> = {};
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
    this.unregisteringQueue[channelId] = code;

    // If we don't get a registration in 60 seconds, clean up the queue
    setTimeout(() => {
      delete this.unregisteringQueue[channelId];
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
          this.unregisteringQueue[message.channelId] ?? ClientUnregisterCodes.USER_UNSUBSCRIBED;
        delete this.unregisteringQueue[message.channelId];

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

    this.mediator.subscriptionHandler.removeSubscription(message.channelId);
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
