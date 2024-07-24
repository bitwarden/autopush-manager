import { ClientBroadcastSubscribe } from "../message";

import { MessageSender, UnknownDeps } from "./message-sender";

export class BroadcastSubscribeSender
  implements MessageSender<ClientBroadcastSubscribe, UnknownDeps>
{
  async buildMessage(): Promise<ClientBroadcastSubscribe> {
    throw new Error("Method not implemented.");
  }
}
