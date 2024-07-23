import { NamespacedLogger } from "../../logger";
import { Guid } from "../../util";
import { UnregisterHandler } from "../handlers/unregister-handler";
import { ClientUnregister, ClientUnregisterCode } from "../message";
import { MessageMediator } from "../message-mediator";
import { MessageSender } from "./message-sender";

type UnregisterDependencies = { readonly channelId: Guid; readonly code: ClientUnregisterCode };

export class UnregisterSender implements MessageSender<ClientUnregister, UnregisterDependencies> {
  constructor(
    private readonly mediator: MessageMediator,
    private readonly logger: NamespacedLogger<"UnregisterSender">
  ) {}

  async buildMessage(deps: UnregisterDependencies): Promise<ClientUnregister> {
    const message: ClientUnregister = {
      messageType: "unregister",
      channelId: deps.channelId,
      code: deps.code,
    };
    const unRegisterHandler = this.mediator.getHandler(UnregisterHandler);
    if (!unRegisterHandler) {
      this.logger.warn(
        "UnregisterHandler not found, cannot inform handler of intended unregister code."
      );
    }
    unRegisterHandler?.expectUnregister(deps.channelId, deps.code);

    this.logger.debug("Building unregister message", message);
    return message;
  }
}
