import { Tagged } from "type-fest";
import { NamespacedLogger } from "./logger";
import { Guid, JoinStrings, newGuid } from "./util";

type EventCallback = (...args: any[]) => void;
type EventMap = { [eventName: string]: EventCallback };
export type ListenerId = Tagged<Guid, "ListenerId">;

export class EventManager<const TEventMap extends EventMap> {
  private readonly callbacks: {
    [eventName in keyof TEventMap]: Record<ListenerId, TEventMap[eventName]>;
  } = {} as any;
  constructor(private readonly logger: NamespacedLogger<JoinStrings<string, "EventManager">>) {}

  public addEventListener<const TEvent extends keyof TEventMap>(
    event: TEvent,
    callback: TEventMap[TEvent]
  ): ListenerId {
    this.logger.debug("Adding event listener", event);
    const callBackId = newGuid<ListenerId>();

    this.callbacksFor(event)[callBackId] = callback;
    return callBackId;
  }

  public dispatchEvent<const TEvent extends keyof TEventMap>(
    event: TEvent,
    ...args: Parameters<TEventMap[TEvent]>
  ) {
    this.logger.debug("Dispatching event", event);
    const callbacks = this.callbacksFor(event);
    for (const callback of Object.values(callbacks)) {
      callback(...args);
    }
  }

  public removeEventListener(event: keyof TEventMap, callbackId: ListenerId) {
    this.logger.debug("Removing event listener", event);
    delete this.callbacksFor(event)[callbackId];
  }

  private callbacksFor(event: keyof TEventMap): Record<ListenerId, TEventMap[keyof TEventMap]> {
    if (!this.callbacks[event]) {
      this.callbacks[event] = {};
    }

    return this.callbacks[event] as Record<ListenerId, TEventMap[keyof TEventMap]>;
  }
}
