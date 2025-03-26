import { EventManager } from "../../event-manager";
import { NamespacedLogger } from "../../logger";
import { Uuid } from "../../string-manipulation";
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
  private readonly unregisteringQueue: Map<Uuid, ClientUnregisterCode> = new Map();
  private readonly eventManager: EventManager<{ unregistered: (channelID: Uuid) => void }>;
  constructor(
    private readonly mediator: MessageMediator,
    private readonly logger: NamespacedLogger<"UnregisterHandler">,
  ) {
    this.eventManager = new EventManager(logger.extend("EventManager"));
  }

  handlesMessage(message: AutoConnectServerMessage): boolean {
    return message.messageType === "unregister";
  }

  expectUnregister(channelID: Uuid, code: ClientUnregisterCode) {
    this.logger.debug("Expecting unregister", { channelID, code });
    this.unregisteringQueue.set(channelID, code);

    // If we don't get a registration in 60 seconds, clean up the queue
    setTimeout(() => {
      this.unregisteringQueue.delete(channelID);
    }, 60_000);
  }

  async handle(message: ServerUnregister): Promise<void> {
    this.logger.debug("Received unregister", message);

    // These error codes are lifted from possible responses to unregister requests
    // see https://github.com/mozilla-services/autopush-rs/blob/e4c153e7dece3e7cc938ca672bd9cab547bdd7e8/autoconnect/autoconnect-ws/autoconnect-ws-sm/src/identified/on_client_msg.rs#L116
    switch (message.status) {
      case 200:
        break;
      case 500: {
        // TODO: Implement a backoff strategy
        this.logger.error("Server error on unregister, retrying in 60 seconds", message);

        const code =
          this.unregisteringQueue.get(message.channelID) ?? ClientUnregisterCodes.USER_UNSUBSCRIBED;
        this.unregisteringQueue.delete(message.channelID);

        setTimeout(
          () =>
            this.mediator.send(UnregisterSender, {
              channelID: message.channelID,
              code,
            }),
          60_000,
        );
        return;
      }
    }

    // Notify listeners that the channel has been unregistered
    this.eventManager.dispatchEvent("unregistered", message.channelID);

    await this.mediator.subscriptionHandler.removeSubscription(message.channelID);
    this.logger.debug("Unregistered subscription", message);
  }

  async awaitUnregister(channelID: Uuid): Promise<void> {
    return new Promise((resolve) => {
      const listener = this.eventManager.addEventListener(
        "unregistered",
        (unregisteredChannelId) => {
          if (unregisteredChannelId === channelID) {
            this.eventManager.removeEventListener("unregistered", listener);
            resolve();
          }
        },
      );
    });
  }
}
