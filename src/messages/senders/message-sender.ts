import { AutoConnectClientMessage } from "../message";

export type UnknownDeps = Record<string, unknown>;
export interface MessageSender<T extends AutoConnectClientMessage, TDeps extends UnknownDeps> {
  buildMessage: (deps: TDeps) => Promise<T>;
}
