import { AutoConnectClientMessage } from "../message";

export type UnknownDeps = Record<string, any>;
export interface MessageSender<T extends AutoConnectClientMessage, TDeps extends UnknownDeps> {
  buildMessage: (deps: TDeps) => Promise<T>;
}
