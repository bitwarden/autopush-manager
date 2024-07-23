import { NamespacedLogger } from "../../logger";
import { Guid } from "../../util";
import { ClientHello } from "../message";
import { MessageSender } from "./message-sender";

type HelloDependencies = { readonly uaid: string | null; readonly channelIds: Guid[] };

export class HelloSender implements MessageSender<ClientHello, HelloDependencies> {
  constructor(private readonly logger: NamespacedLogger<"HelloSender">) {}
  async buildMessage(deps: HelloDependencies): Promise<ClientHello> {
    const message: ClientHello = {
      messageType: "hello",
      uaid: deps.uaid,
      channelIds: deps.channelIds,
    };
    this.logger.debug("Building hello message", message);
    return message;
  }
}
