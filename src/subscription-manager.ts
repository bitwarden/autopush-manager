import { NamespacedLogger } from "./logger";
import { NamespacedStorage, Storage } from "./storage";
import { PushSubscription, PushSubscriptionOptions } from "./push-subscription";
import { Guid } from "./string-manipulation";

export class SubscriptionHandler {
  private subscriptions: Record<Guid, PushSubscription<Guid>> = {};
  private constructor(
    private readonly storage: Storage,
    private readonly unsubscribeCallback: (channelId: Guid) => Promise<void>,
    private readonly logger: NamespacedLogger<"SubscriptionHandler">
  ) {}

  public static async create(
    storage: Storage,
    unsubscribeCallback: (channelId: Guid) => Promise<void>,
    logger: NamespacedLogger<"SubscriptionHandler">
  ) {
    const handler = new SubscriptionHandler(storage, unsubscribeCallback, logger);
    await handler.loadSubscriptions();
    return handler;
  }

  public async addSubscription<TChannelId extends Guid>(
    channelId: TChannelId,
    endpoint: string,
    options: PushSubscriptionOptions
  ) {
    this.logger.debug("Adding subscription", { channelId, endpoint, options });
    const storage = new NamespacedStorage(this.storage, channelId);

    const subscription = await PushSubscription.create(
      storage,
      endpoint,
      options,
      () => this.unsubscribeCallback(channelId),
      this.logger.extend(channelId)
    );
    this.subscriptions[channelId] = subscription;
    this.writeChannelIds();
    this.logger.debug("Added subscription", { channelId, endpoint, options });
    return subscription;
  }

  public get channelIds() {
    return Object.keys(this.subscriptions) as Guid[];
  }

  public get(channelId: Guid) {
    const sub = this.subscriptions[channelId];
    if (!sub) {
      throw new Error("Subscription not found");
    }
    return sub;
  }

  public getByApplicationServerKey(
    applicationServerKey: string
  ): PushSubscription<Guid> | undefined {
    return Object.values(this.subscriptions).find(
      (sub) => sub.options.applicationServerKey === applicationServerKey
    );
  }

  public async removeSubscription(channelId: Guid) {
    this.logger.debug("Removing subscription", channelId);
    const subscription = this.subscriptions[channelId];
    if (!subscription) {
      this.logger.warn("Subscription not found", channelId);
      return;
    }
    await subscription.destroy();
    delete this.subscriptions[channelId];
    this.writeChannelIds();
    this.logger.debug("Removed subscription", channelId);
  }

  public async removeAllSubscriptions() {
    for (const channelId of Object.keys(this.subscriptions)) {
      const guid = channelId as Guid;
      await this.removeSubscription(guid);
    }
  }

  private async loadSubscriptions() {
    const channelIds = await this.storage.read<string[]>("channelIds");
    if (!channelIds) {
      return;
    }
    for (const channelId of channelIds) {
      const guid = channelId as Guid;
      const storage = new NamespacedStorage(this.storage, guid);
      try {
        const subscription = await PushSubscription.recover(
          storage,
          () => this.unsubscribeCallback(guid),
          this.logger.extend(guid)
        );
        this.subscriptions[guid] = subscription;
      } catch (e) {
        this.logger.error("Failed to recover subscription", e);
      }
    }
  }

  private async writeChannelIds() {
    await this.storage.write("channelIds", Object.keys(this.subscriptions));
  }
}
