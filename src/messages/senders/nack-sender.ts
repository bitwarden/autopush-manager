import { ClientNack } from "../message";

import { MessageSender, UnknownDeps } from "./message-sender";

export class NackSender implements MessageSender<ClientNack, UnknownDeps> {
  async buildMessage(): Promise<ClientNack> {
    throw new Error("Method not implemented.");
  }
}
