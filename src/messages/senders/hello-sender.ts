import { NamespacedLogger } from "../../logger";
import { Uuid } from "../../string-manipulation";
import { ClientHello } from "../message";

import { MessageSender } from "./message-sender";

type HelloDependencies = { readonly uaid: string | null; readonly channelIDs: Uuid[] };

export class HelloSender implements MessageSender<ClientHello, HelloDependencies> {
  constructor(private readonly logger: NamespacedLogger<"HelloSender">) {}
  async buildMessage(deps: HelloDependencies): Promise<ClientHello> {
    const message: ClientHello = {
      messageType: "hello",
      uaid: deps.uaid ?? "",
      channelIDs: deps.channelIDs ?? [],
      use_webpush: true,
    };
    this.logger.debug("Building hello message", message);
    return message;
  }
}
