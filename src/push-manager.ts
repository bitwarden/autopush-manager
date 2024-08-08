import { WebSocket } from "ws";

import { Logger, NamespacedLogger, TimedLogger } from "./logger";
import { RegisterHandler } from "./messages/handlers/register-handler";
import { UnregisterHandler } from "./messages/handlers/unregister-handler";
import { AutoConnectServerMessage, ClientUnregisterCodes } from "./messages/message";
import { MessageMediator } from "./messages/message-mediator";
import { HelloSender } from "./messages/senders/hello-sender";
import { RegisterSender } from "./messages/senders/register-sender";
import { UnregisterSender } from "./messages/senders/unregister-sender";
import {
  GenericPushSubscription,
  PublicPushSubscription,
  PushSubscriptionOptions,
} from "./push-subscription";
import { PublicStorage, Storage } from "./storage";
import { Uuid } from "./string-manipulation";
import { SubscriptionHandler } from "./subscription-handler";

export interface PublicPushManager {
  subscribe(options: PushSubscriptionOptions): Promise<PublicPushSubscription>;
  destroy(): Promise<void>;
}

type PushManagerOptions = {
  autopushUrl: string;
};

const defaultPushManagerOptions: PushManagerOptions = Object.freeze({
  autopushUrl: "wss://push.services.mozilla.com",
});

export class PushManager implements PublicPushManager {
  private _uaid: string | null = null;
  private _websocket: WebSocket | null = null;
  private _helloResolve: (() => void) | null = null;
  private reconnect = true;
  private wsOpenTime: number | null = null;
  private mediator!: MessageMediator; // This is assigned in the create method
  private subscriptionHandler!: SubscriptionHandler; // This is assigned in the create method
  private constructor(
    private readonly storage: Storage,
    private readonly logger: Logger,
    private readonly options: PushManagerOptions,
  ) {}

  get uaid() {
    return this._uaid;
  }

  async setUaid(value: string) {
    this._uaid = value;
    await this.storage.write("uaid", value);
  }

  async completeHello(uaid: string) {
    if (this._uaid !== uaid) {
      await this.setUaid(uaid);
    }
    setTimeout(() => {
      this._helloResolve?.();
    }, 1000);
    // this._helloResolve?.();
  }

  get websocket() {
    return this._websocket;
  }

  async subscribe(options: PushSubscriptionOptions): Promise<GenericPushSubscription> {
    if (!options || !options.applicationServerKey) {
      throw new Error("Invalid options. Only VAPID authenticated subscriptions are supported");
    }

    if (!this.subscriptionHandler || !this._websocket) {
      throw new Error("class not initialized");
    }

    const existing = this.subscriptionHandler.getByApplicationServerKey(
      options.applicationServerKey,
    );
    if (existing) {
      return existing;
    }

    const handler = this.mediator.getHandler(RegisterHandler);
    if (!handler) {
      throw new Error("RegisterHandler not found, cannot complete registration.");
    }

    const promise = handler.awaitRegister(options.applicationServerKey);
    await this.mediator.send(RegisterSender, { options });
    return await promise;
  }

  async unsubscribe(channelID: Uuid) {
    if (!this.subscriptionHandler || !this._websocket) {
      throw new Error("class not initialized");
    }

    const promise = this.mediator.getHandler(UnregisterHandler)?.awaitUnregister(channelID);
    await this.mediator.send(UnregisterSender, {
      channelID,
      code: ClientUnregisterCodes.USER_UNSUBSCRIBED,
    });

    await promise;
  }

  static async create(
    externalStorage: PublicStorage,
    externalLogger: Logger,
    options: PushManagerOptions = defaultPushManagerOptions,
  ) {
    const storage = new Storage(externalStorage);
    const logger = new TimedLogger(externalLogger);
    const manager = new PushManager(storage, logger, options);
    const subscriptionHandler = await SubscriptionHandler.create(
      storage,
      (channelID: Uuid) => manager.unsubscribe(channelID),
      new NamespacedLogger(logger, "SubscriptionHandler"),
    );
    const mediator = new MessageMediator(manager, subscriptionHandler, logger);

    // Assign the circular dependencies
    manager.mediator = mediator;
    manager.subscriptionHandler = subscriptionHandler;
    await manager.init();
    return manager;
  }

  private async init(): Promise<void> {
    this._uaid = await this.storage.read<string>("uaid");

    if (!this._websocket) {
      await this.connect();
    }
  }

  async destroy() {
    this.reconnect = false;
    this._websocket?.close();
  }

  private async connect() {
    if (this._websocket) {
      throw new Error("WebSocket already connected");
    }

    const helloCompleted = new Promise<void>((resolve) => {
      this._helloResolve = resolve;
    });
    this._websocket = new WebSocket(this.options.autopushUrl);
    this._websocket.onmessage = async (event) => {
      // this.logger.debug("Received ws message", event);
      let messageData: AutoConnectServerMessage;
      if (typeof event.data === "string") {
        messageData = JSON.parse(event.data) as AutoConnectServerMessage;
      } else if (event.data instanceof ArrayBuffer) {
        messageData = JSON.parse(Buffer.from(event.data).toString()) as AutoConnectServerMessage;
      } else {
        this.logger.error("Unexpected message data type", event.data);
        return;
      }
      await this.mediator.handle(messageData);
    };
    this._websocket.once("open", async () => {
      await this.mediator.send(HelloSender, {
        uaid: this._uaid,
        channelIDs: this.subscriptionHandler.channelIDs,
      });
    });
    this._websocket.onopen = async () => {
      this.wsOpenTime = new Date().getTime();
      this.logger.debug("WebSocket connection opened");
    };
    this._websocket.onclose = async (e) => {
      this.logger.debug("WebSocket connection closed", e.reason, e.code);
      this._websocket = null;
      const timeOpen = this.wsOpenTime == null ? 0 : new Date().getTime() - this.wsOpenTime;
      this.wsOpenTime = null;
      this.logger.debug(
        `WebSocket connection closed. Connection open for ${timeOpen / 1000} seconds`,
      );

      // TODO: implement a backoff strategy
      if (this.reconnect) {
        setTimeout(() => this.connect(), 1000);
        // await this.connect();
      }
    };

    await helloCompleted;
  }
}
