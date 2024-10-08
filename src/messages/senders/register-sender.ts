import { EventManager } from "../../event-manager";
import { NamespacedLogger } from "../../logger";
import { PushSubscriptionEvents, PushSubscriptionOptions } from "../../push-subscription";
import { newUuid } from "../../string-manipulation";
import { RegisterHandler } from "../handlers/register-handler";
import { ClientRegister } from "../message";
import { MessageMediator } from "../message-mediator";

import { MessageSender } from "./message-sender";

type RegisterDeps = {
  readonly options: PushSubscriptionOptions;
  readonly eventManager?: EventManager<PushSubscriptionEvents>;
};
export class RegisterSender implements MessageSender<ClientRegister, RegisterDeps> {
  constructor(
    private readonly mediator: MessageMediator,
    private readonly logger: NamespacedLogger<"RegisterSender">,
  ) {}

  async buildMessage(deps: RegisterDeps): Promise<ClientRegister> {
    if (!this.mediator.pushManager.uaid) {
      throw new Error("Hello not completed. Try again later");
    }
    if (!deps?.options) {
      throw new Error("No options provided");
    }

    const channelID = newUuid();
    const message: ClientRegister = {
      messageType: "register",
      channelID,
      key: deps.options.applicationServerKey,
    };
    const registerHandler = this.mediator.getHandler(RegisterHandler);
    if (!registerHandler) {
      throw new Error("RegisterHandler not found, cannot complete registration.");
    }
    registerHandler.expectRegister(channelID, deps.options);
    this.logger.debug("Building register message", message);

    return message;
  }
}
