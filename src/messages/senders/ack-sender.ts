import { NamespacedLogger } from "../../logger";
import { ClientAck, ClientMessageAck } from "../message";

type AckDependencies = {
  readonly updates: ClientMessageAck[];
};

// Class does not implement MessageSender so that it cannot be requested from the mediator
export class AckSender {
  constructor(private readonly logger: NamespacedLogger<"AckSender">) {}

  async buildMessage(deps: AckDependencies): Promise<ClientAck> {
    const message: ClientAck = {
      messageType: "ack",
      updates: deps.updates,
    };
    this.logger.debug("Building ack message", message);
    return message;
  }
}
