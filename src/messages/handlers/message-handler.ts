import { AutoConnectServerMessage } from "../message";

export interface MessageHandler<T extends AutoConnectServerMessage> {
  handlesMessage(message: AutoConnectServerMessage): boolean;
  handle(message: T): Promise<void>;
}
