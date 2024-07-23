import { NamespacedLogger } from "../../logger";
import { AutoConnectServerMessage, ClientUnregisterCodes, ServerRegister } from "../message";
import { PushSubscriptionOptions, PushSubscription } from "../../push-subscription";
import { MessageMediator } from "../message-mediator";
import { MessageHandler } from "./message-handler";
import { Guid } from "../../util";
import { RegisterSender } from "../senders/register-sender";
import { UnregisterSender } from "../senders/unregister-sender";
import { EventManager } from "../../event-manager";

export class RegisterHandler implements MessageHandler<ServerRegister> {
  private readonly registeringQueue: Record<Guid, PushSubscriptionOptions> = {};
  private readonly eventManager: EventManager<{
    registered: (subscription: PushSubscription<Guid>, channelId: Guid) => void;
  }>;
  constructor(
    private readonly mediator: MessageMediator,
    private readonly logger: NamespacedLogger<"RegisterHandler">
  ) {
    this.eventManager = new EventManager(logger.extend("EventManager"));
  }
  handlesMessage(message: AutoConnectServerMessage): boolean {
    return message.messageType === "register";
  }

  /**
   * Informs the RegisterHandler that a registration is expected for a given channelId and provides the registration's options for when it arrives.
   * @param channelId The channelId to expect
   * @param options The options to use when registering
   */
  expectRegister(channelId: Guid, options: PushSubscriptionOptions) {
    this.logger.debug("Expecting register", { channelId, options });
    this.registeringQueue[channelId] = options;

    // If we don't get a registration in 60 seconds, clean up the queue
    setTimeout(() => {
      delete this.registeringQueue[channelId];
    }, 60_000);
  }

  async handle(message: ServerRegister): Promise<void> {
    this.logger.debug("Received received", message);

    switch (message.status) {
      case 200:
        break;
      case 409: {
        this.logger.error("Conflict on register. Retrying", message);
        const options = this.registeringQueue[message.channelId];
        delete this.registeringQueue[message.channelId];
        await this.mediator.send(RegisterSender, { options });
        return;
      }
      case 500: {
        // FIXME: what's an appropriate retry strategy here?
        this.logger.error("Server error on register, retrying in 60 seconds", message);
        const options = this.registeringQueue[message.channelId];
        delete this.registeringQueue[message.channelId];
        setTimeout(() => this.mediator.send(RegisterSender, { options }), 60_000);
        return;
      }
      default: {
        this.logger.warn("Unknown register status", message);
        return;
      }
    }

    const options = this.registeringQueue[message.channelId];
    if (!options) {
      this.logger.error("No options found for channelId, unregistering", message);
      // Clean up the registration we can't complete
      await this.mediator.send(UnregisterSender, {
        channelId: message.channelId,
        code: ClientUnregisterCodes.USER_UNSUBSCRIBED, // FIXME: what code should we use here?
      });
      return;
    }
    this.logger.debug("Removing expected registration from queue", message.channelId);
    delete this.registeringQueue[message.channelId];

    const subscription = await this.mediator.subscriptionHandler.addSubscription(
      message.channelId,
      message.pushEndpoint,
      options
    );

    // Notify any listeners that the registration has been completed
    this.eventManager.dispatchEvent("registered", subscription, message.channelId);

    this.logger.debug("Registered handled", message);
  }

  async awaitRegister(applicationServerKey: string): Promise<PushSubscription<Guid>> {
    return new Promise((resolve) => {
      const listener = this.eventManager.addEventListener("registered", (subscription) => {
        if (subscription.options.applicationServerKey === applicationServerKey) {
          this.eventManager.removeEventListener("registered", listener);
          resolve(subscription);
        }
      });
    });
  }
}
