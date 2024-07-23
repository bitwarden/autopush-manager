import { Constructor } from "type-fest";
import { HelloHandler } from "./handlers/hello-handler";
import { AutoConnectClientMessage, AutoConnectServerMessage, ClientMessageAck } from "./message";
import { MessageHandler } from "./handlers/message-handler";
import { MessageSender, UnknownDeps } from "./senders/message-sender";
import { Logger, NamespacedLogger } from "../logger";
import { PingSender } from "./senders/ping-sender";
import { PushManager } from "../push-manager";
import { SubscriptionHandler } from "../subscription-manager";
import { HelloSender } from "./senders/hello-sender";
import { RegisterHandler } from "./handlers/register-handler";
import { UnregisterHandler } from "./handlers/unregister-handler";
import { BroadcastHandler } from "./handlers/broadcast-handler";
import { NotificationHandler } from "./handlers/notification-handler";
import { PingHandler } from "./handlers/ping-handler";
import { RegisterSender } from "./senders/register-sender";
import { UnregisterSender } from "./senders/unregister-sender";
import { AckSender } from "./senders/ack-sender";
import { NackSender } from "./senders/nack-sender";
import { BroadcastSubscribeSender } from "./senders/broadcast-subscribe-sender";

const ACK_INTERVAL = 30_000; // 30 seconds

export class MessageMediator {
  private handlers: MessageHandler<AutoConnectServerMessage>[];
  // TODO: get rid of this any
  private senders: MessageSender<AutoConnectClientMessage, any>[];
  private ackInterval: NodeJS.Timeout | null = null;
  private ackQueue: ClientMessageAck[] = [];
  private ackSender: AckSender;
  constructor(
    public readonly pushManager: PushManager,
    public readonly subscriptionHandler: SubscriptionHandler,
    private readonly logger: Logger
  ) {
    this.handlers = [
      new HelloHandler(this, new NamespacedLogger(logger, "HelloHandler")),
      new RegisterHandler(this, new NamespacedLogger(logger, "RegisterHandler")),
      new UnregisterHandler(this, new NamespacedLogger(logger, "UnregisterHandler")),
      new BroadcastHandler(new NamespacedLogger(logger, "BroadcastHandler")),
      new NotificationHandler(this, new NamespacedLogger(logger, "NotificationHandler")),
      new PingHandler(new NamespacedLogger(logger, "PingHandler")),
    ];
    this.senders = [
      new HelloSender(new NamespacedLogger(logger, "HelloSender")),
      new RegisterSender(this, new NamespacedLogger(logger, "RegisterSender")),
      new UnregisterSender(this, new NamespacedLogger(logger, "UnregisterSender")),
      new BroadcastSubscribeSender(),
      new NackSender(),
      new PingSender(new NamespacedLogger(logger, "PingSender")),
    ];
    // Ack is separate because acks are grouped to reduce server load
    this.ackSender = new AckSender(new NamespacedLogger(logger, "AckSender"));

    this.ackInterval = setInterval(() => this.sendAck(), ACK_INTERVAL);
  }

  public destroy() {
    if (this.ackInterval) {
      clearInterval(this.ackInterval);
    }
  }

  /**
   * Gets a message sender of the requested type
   * @param type The type of sender to get
   * @returns The registered sender or null if not found
   */
  public getSender<T extends MessageSender<any, any>>(type: Constructor<T>): T | null {
    return this.senders.find((sender) => sender instanceof type) as T | null;
  }

  /**
   * Gets a message handler of the requested type
   * @param type The type of handler to get
   * @returns the first registered handler of the given type or null if not found
   */
  public getHandler<T extends MessageHandler<AutoConnectServerMessage>>(
    type: Constructor<T>
  ): T | null {
    return this.handlers.find((handler) => handler instanceof type) as T | null;
  }

  public async handle(message: AutoConnectServerMessage): Promise<void> {
    const handler = this.handlers.find((h) => h.handlesMessage(message));
    if (!handler) {
      this.logger.error(`No handler found for ${message.messageType}`);
      return;
    }

    await handler.handle(message);
  }

  /**
   * Sends a message along the currently active websocket connection
   * @param type The type of message to send
   * @param deps The dependencies to build the requested message
   *
   * @throws Error if no sender is found for the given type
   */
  async send<T extends MessageSender<any, TDeps>, TDeps extends UnknownDeps>(
    type: Constructor<T>,
    deps: TDeps
  ): Promise<void> {
    if (!this.pushManager.websocket) {
      throw new Error("No websocket connection");
    }

    const sender = this.getSender<T>(type);
    if (!sender) {
      throw new Error(`No sender found for ${type.name}`);
    }

    const message = await sender.buildMessage(deps);
    this.pushManager.websocket.send(JSON.stringify(message));
  }

  ack(ack: ClientMessageAck) {
    this.ackQueue.push(ack);
  }

  private async sendAck() {
    if (this.ackQueue.length === 0) {
      this.logger.debug("No acks to send");
      return;
    }

    if (!this.pushManager.websocket) {
      this.logger.error("No websocket connection to send acks");
      return;
    }

    const updates = this.ackQueue.slice();
    this.ackQueue = [];

    const message = await this.ackSender.buildMessage({ updates });
    this.pushManager.websocket.send(JSON.stringify(message));
    this.logger.debug("Sent acks", message);
  }
}