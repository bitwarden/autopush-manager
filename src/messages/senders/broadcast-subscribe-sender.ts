import { ClientBroadcastSubscribe } from "../message";
import { MessageSender } from "./message-sender";

export class BroadcastSubscribeSender implements MessageSender<ClientBroadcastSubscribe, {}> {
  constructor() {}

  async buildMessage(): Promise<ClientBroadcastSubscribe> {
    throw new Error("Method not implemented.");
  }
}
