import { NamespacedLogger } from "../../logger";
import { AutoConnectServerMessage, ServerHello } from "../message";
import { MessageMediator } from "../message-mediator";
import { PingSender } from "../senders/ping-sender";

import { MessageHandler } from "./message-handler";

export class HelloHandler implements MessageHandler<ServerHello> {
  constructor(
    private readonly mediator: MessageMediator,
    private readonly logger: NamespacedLogger<"HelloHandler">,
  ) {}

  handlesMessage(message: AutoConnectServerMessage): boolean {
    return message.messageType === "hello";
  }

  async handle(message: ServerHello): Promise<void> {
    this.logger.debug("Hello received", message);

    await this.mediator.pushManager.completeHello(message.uaid);

    const currentUaid = this.mediator.pushManager.uaid;
    if (currentUaid && currentUaid !== message.uaid) {
      // We've been assigned a new UAID. Clear out all subscriptions.
      // and re-register
      await this.mediator.subscriptionHandler.reInitAllSubscriptions(this.mediator);
    }

    const pingSender = this.mediator.getSender(PingSender);
    if (!pingSender) {
      this.logger.warn("PingSender not found");
    } else {
      pingSender.justPinged();
    }

    this.logger.debug("Hello Handled", message);
  }
}
