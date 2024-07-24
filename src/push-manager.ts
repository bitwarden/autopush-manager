import { Logger, NamespacedLogger } from "./logger";
import { Storage } from "./storage";
import {
  PublicPushSubscription,
  PushSubscription,
  PushSubscriptionOptions,
} from "./push-subscription";
import { Guid } from "./string-manipulation";
import { SubscriptionHandler } from "./subscription-manager";
import { MessageMediator } from "./messages/message-mediator";
import { HelloSender } from "./messages/senders/hello-sender";
import { RegisterSender } from "./messages/senders/register-sender";
import { UnregisterSender } from "./messages/senders/unregister-sender";
import { ClientUnregisterCodes } from "./messages/message";
import { UnregisterHandler } from "./messages/handlers/unregister-handler";
import { RegisterHandler } from "./messages/handlers/register-handler";

export interface PublicPushManager {
  subscribe(options: PushSubscriptionOptions): Promise<PublicPushSubscription>;
}

export class PushManager implements PublicPushManager {
  private _uaid: string | null = null;
  private _websocket: WebSocket | null = null;
  private reconnect = true;
  private wsOpenTime: number | null = null;
  private mediator!: MessageMediator; // This is assigned in the create method
  private subscriptionHandler!: SubscriptionHandler; // This is assigned in the create method
  private constructor(private readonly storage: Storage, private readonly logger: Logger) {}

  get uaid() {
    return this._uaid;
  }

  async setUaid(value: string) {
    this._uaid = value;
    await this.storage.write("uaid", value);
  }

  get websocket() {
    return this._websocket;
  }

  async subscribe(options: PushSubscriptionOptions): Promise<PushSubscription<Guid>> {
    if (!options || !options.applicationServerKey) {
      throw new Error("Invalid options. Only VAPID authenticated subscriptions are supported");
    }

    if (!this.subscriptionHandler || !this._websocket) {
      throw new Error("class not initialized");
    }

    const existing = this.subscriptionHandler.getByApplicationServerKey(
      options.applicationServerKey
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

  async unsubscribe(channelId: Guid) {
    if (!this.subscriptionHandler || !this._websocket) {
      throw new Error("class not initialized");
    }

    const promise = this.mediator.getHandler(UnregisterHandler)?.awaitUnregister(channelId);
    await this.mediator.send(UnregisterSender, {
      channelId,
      code: ClientUnregisterCodes.USER_UNSUBSCRIBED,
    });

    await promise;
  }

  public static async create(storage: Storage, logger: Logger) {
    const manager = new PushManager(storage, logger);
    const subscriptionHandler = await SubscriptionHandler.create(
      storage,
      (channelId: Guid) => manager.unsubscribe(channelId),
      new NamespacedLogger(logger, "SubscriptionHandler")
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

  public async shutdown() {
    this.reconnect = false;
    this._websocket?.close();
  }

  public async destroy() {
    await this.shutdown();
  }

  private async connect() {
    if (this._websocket) {
      throw new Error("WebSocket already connected");
    }

    this._websocket = new WebSocket("wss://push.services.mozilla.com");
    this._websocket.onmessage = async (event) => {
      this.logger.debug("Received ws message", event);
      this.mediator.handle(event.data);
    };
    this._websocket.onopen = async () => {
      this.wsOpenTime = new Date().getTime();
      this.logger.debug("WebSocket connection opened");
    };
    this._websocket.onclose = async () => {
      this._websocket = null;
      const timeOpen = new Date().getTime() - this.wsOpenTime!;
      this.wsOpenTime = null;
      this.logger.debug(
        `WebSocket connection closed. Connection open for ${timeOpen / 1000} seconds`
      );

      // TODO: implement a backoff strategy
      if (this.reconnect) {
        await this.connect();
      }
    };

    await this.mediator.send(HelloSender, {
      uaid: this._uaid,
      channelIds: this.subscriptionHandler.channelIds,
    });
  }
}
