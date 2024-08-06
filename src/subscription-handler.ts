import { NamespacedLogger } from "./logger";
import {
  GenericPushSubscription,
  PushSubscription,
  PushSubscriptionOptions,
} from "./push-subscription";
import { Storage } from "./storage";
import { Uuid } from "./string-manipulation";

export class SubscriptionHandler {
  private readonly subscriptions: Map<Uuid, GenericPushSubscription> = new Map();
  private constructor(
    private readonly storage: Storage,
    private readonly unsubscribeCallback: (channelID: Uuid) => Promise<void>,
    private readonly logger: NamespacedLogger<"SubscriptionHandler">,
  ) {}

  static async create(
    storage: Storage,
    unsubscribeCallback: (channelID: Uuid) => Promise<void>,
    logger: NamespacedLogger<"SubscriptionHandler">,
  ) {
    const handler = new SubscriptionHandler(storage, unsubscribeCallback, logger);
    await handler.loadSubscriptions();
    return handler;
  }

  async addSubscription<TChannelId extends Uuid>(
    channelID: TChannelId,
    endpoint: string,
    options: PushSubscriptionOptions,
  ) {
    this.logger.debug("Adding subscription", { channelID, endpoint, options });

    const subscription = await PushSubscription.create(
      channelID,
      this.storage,
      endpoint,
      options,
      () => this.unsubscribeCallback(channelID),
      this.logger,
    );
    this.subscriptions.set(channelID, subscription);
    await this.writeChannelIds();
    this.logger.debug("Added subscription", { channelID, endpoint, options });
    return subscription;
  }

  get channelIDs() {
    return [...this.subscriptions.keys()];
  }

  get(channelID: Uuid) {
    const sub = this.subscriptions.get(channelID);
    if (!sub) {
      throw new Error("Subscription not found");
    }
    return sub;
  }

  getByApplicationServerKey(applicationServerKey: string): GenericPushSubscription | undefined {
    return [...this.subscriptions.values()].find(
      (sub) => sub.options.applicationServerKey === applicationServerKey,
    );
  }

  async removeSubscription(channelID: Uuid) {
    this.logger.debug("Removing subscription", channelID);
    const subscription = this.subscriptions.get(channelID);
    if (!subscription) {
      this.logger.warn("Subscription not found", channelID);
      return;
    }
    await subscription.destroy();
    this.subscriptions.delete(channelID);
    await this.writeChannelIds();
    this.logger.debug("Removed subscription", channelID);
  }

  async removeAllSubscriptions() {
    for (const channelID of this.subscriptions.keys()) {
      const guid = channelID as Uuid;
      await this.removeSubscription(guid);
    }
  }

  private async loadSubscriptions() {
    const channelIDs = await this.storage.read<string[]>("channelIDs");
    if (!channelIDs) {
      return;
    }
    for (const channelID of channelIDs) {
      const guid = channelID as Uuid;
      const storage = this.storage.extend(guid);
      try {
        const subscription = await PushSubscription.recover(
          guid,
          storage,
          () => this.unsubscribeCallback(guid),
          this.logger.extend(guid),
        );
        this.subscriptions.set(guid, subscription);
      } catch (e) {
        this.logger.error("Failed to recover subscription", e);
      }
    }
  }

  private async writeChannelIds() {
    await this.storage.write("channelIDs", this.channelIDs);
  }
}
