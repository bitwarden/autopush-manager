import { EventManager } from "../../event-manager";
import { NamespacedLogger } from "../../logger";
import {
  PushSubscriptionOptions,
  GenericPushSubscription,
  PushSubscriptionEvents,
} from "../../push-subscription";
import { Uuid } from "../../string-manipulation";
import { AutoConnectServerMessage, ClientUnregisterCodes, ServerRegister } from "../message";
import { MessageMediator } from "../message-mediator";
import { RegisterSender } from "../senders/register-sender";
import { UnregisterSender } from "../senders/unregister-sender";

import { MessageHandler } from "./message-handler";

export class RegisterHandler implements MessageHandler<ServerRegister> {
  private readonly registeringQueue: Map<
    Uuid,
    { options: PushSubscriptionOptions; eventManager?: EventManager<PushSubscriptionEvents> }
  > = new Map();
  private readonly eventManager: EventManager<{
    registered: (subscription: GenericPushSubscription, channelID: Uuid) => void;
  }>;
  constructor(
    private readonly mediator: MessageMediator,
    private readonly logger: NamespacedLogger<"RegisterHandler">,
  ) {
    this.eventManager = new EventManager(logger.extend("EventManager"));
  }
  handlesMessage(message: AutoConnectServerMessage): boolean {
    return message.messageType === "register";
  }

  /**
   * Informs the RegisterHandler that a registration is expected for a given channelID and provides the registration's options for when it arrives.
   * @param channelID The channelID to expect
   * @param options The options to use when registering
   */
  expectRegister(
    channelID: Uuid,
    options: PushSubscriptionOptions,
    eventManager?: EventManager<PushSubscriptionEvents>,
  ) {
    this.logger.debug("Expecting register", { channelID, options });
    this.registeringQueue.set(channelID, { options, eventManager });

    // If we don't get a registration in 60 seconds, clean up the queue
    setTimeout(() => {
      this.registeringQueue.delete(channelID);
    }, 60_000);
  }

  async handle(message: ServerRegister): Promise<void> {
    this.logger.debug("Received received", message);

    switch (message.status) {
      case 200:
        break;
      case 409: {
        this.logger.error("Conflict on register. Retrying", message);
        await this.retryRegister(message.channelID, 0);
        return;
      }
      case 500: {
        // FIXME: what's an appropriate retry strategy here?
        this.logger.error("Server error on register, retrying in 60 seconds", message);
        // FIXME: do we want to await the retry?
        void this.retryRegister(message.channelID, 60_000);
        return;
      }
      default: {
        this.logger.warn("Unknown register status", message);
        return;
      }
    }

    const expected = this.registeringQueue.get(message.channelID);
    if (!expected) {
      this.logger.error("No options found for channelID, unregistering", message);
      // Clean up the registration we can't complete
      await this.mediator.send(UnregisterSender, {
        channelID: message.channelID,
        code: ClientUnregisterCodes.USER_UNSUBSCRIBED, // FIXME: what code should we use here?
      });
      return;
    }
    const { options, eventManager } = expected;
    this.logger.debug("Removing expected registration from queue", message.channelID);
    this.registeringQueue.delete(message.channelID);

    const subscription = await this.mediator.subscriptionHandler.addSubscription(
      message.channelID,
      message.pushEndpoint,
      options,
      eventManager,
    );

    // Notify any listeners that the registration has been completed
    this.eventManager.dispatchEvent("registered", subscription, message.channelID);

    this.logger.debug("Registered handled", message);
  }

  async awaitRegister(applicationServerKey: string): Promise<GenericPushSubscription> {
    return new Promise((resolve) => {
      const listener = this.eventManager.addEventListener("registered", (subscription) => {
        if (subscription.options.applicationServerKey === applicationServerKey) {
          this.eventManager.removeEventListener("registered", listener);
          resolve(subscription);
        }
      });
    });
  }

  private async retryRegister(channelID: Uuid, timeoutMs: number) {
    const fromQueue = this.registeringQueue.get(channelID);
    if (!fromQueue) {
      this.logger.error("No options found for channelID, cannot retry", channelID);
      return;
    }
    this.logger.debug("Retrying register", channelID, fromQueue);
    const send = () =>
      this.mediator.send(RegisterSender, {
        options: fromQueue.options,
        eventManager: fromQueue.eventManager,
      });
    return timeoutMs <= 0
      ? await send()
      : new Promise<void>((resolve) =>
          setTimeout(async () => {
            await send();
            resolve();
          }, timeoutMs),
        );
  }
}
