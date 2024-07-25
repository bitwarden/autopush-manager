import { TestLogger } from "../spec/test-logger";
import { TestStorage } from "../spec/test-storage";

import { NamespacedLogger } from "./logger";
import { newGuid } from "./string-manipulation";
import { SubscriptionHandler } from "./subscription-handler";

describe("SubscriptionManager", () => {
  let storage: TestStorage;
  let logger: NamespacedLogger<"SubscriptionHandler">;
  const unsubscribeCallback = jest.fn();
  let manager: SubscriptionHandler;

  const channelId = newGuid();
  const endpoint = "https://example.com/";
  const options = {
    userVisibleOnly: true,
    applicationServerKey:
      "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  };

  beforeEach(async () => {
    storage = new TestStorage();
    logger = new TestLogger().setNamespace("SubscriptionHandler");
    manager = await SubscriptionHandler.create(storage, unsubscribeCallback, logger);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it.todo("reloads subscriptions from storage on create");

  it("adds a subscription", async () => {
    const subscription = await manager.addSubscription(channelId, endpoint, options);

    expect(subscription).toBeDefined();
    expect(subscription["endpoint"].toString()).toEqual(endpoint);
    expect(manager["subscriptions"].get(channelId)).toEqual(subscription);
  });

  // it("updates storage when a subscription is added", async () => {
  //   await manager.addSubscription(channelId, endpoint, options);
  //   expect(storage.store.get("channelIds")).toEqual([channelId]);
  // });

  // it("subscribes to a topic", async () => {
  //   const topic = "test";
  //   const callback = jest.fn();
  //   await manager.subscribe(topic, callback);
  //   await manager.publish(topic, "test");
  //   expect(callback).toHaveBeenCalledWith("test");
  // });

  // it("unsubscribes from a topic", async () => {
  //   const topic = "test";
  //   const callback = jest.fn();
  //   const subscription = await manager.subscribe(topic, callback);
  //   await manager.unsubscribe(subscription);
  //   await manager.publish(topic, "test");
  //   expect(callback).not.toHaveBeenCalled();
  // });

  // it("unsubscribes from all topics", async () => {
  //   const topic = "test";
  //   const callback = jest.fn();
  //   await manager.subscribe(topic, callback);
  //   await manager.unsubscribeAll();
  //   await manager.publish(topic, "test");
  //   expect(callback).not.toHaveBeenCalled();
  // });
});
