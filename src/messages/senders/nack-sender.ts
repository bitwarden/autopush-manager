import { ClientNack } from "../message";
import { MessageSender } from "./message-sender";

export class NackSender implements MessageSender<ClientNack, {}> {
  constructor() {}

  async buildMessage(): Promise<ClientNack> {
    throw new Error("Method not implemented.");
  }
}
