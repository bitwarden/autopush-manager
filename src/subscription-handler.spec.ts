import { MockProxy } from "jest-mock-extended";

import { TestLogger } from "../spec/test-logger";
import { TestStorage } from "../spec/test-storage";

import { Logger, NamespacedLogger } from "./logger";
import { newGuid } from "./string-manipulation";
import { SubscriptionHandler } from "./subscription-handler";

describe("SubscriptionManager", () => {
  let storage: TestStorage;
  let logger: NamespacedLogger<"SubscriptionHandler">;
  let loggerMock: MockProxy<Logger>;
  const unsubscribeCallback = jest.fn();
  let manager: SubscriptionHandler;

  let subCount = 4;
  function createSubscriptionData() {
    return [
      newGuid(),
      "https://example.com/" + subCount,
      {
        userVisibleOnly: true,
        applicationServerKey:
          "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw" +
          subCount++,
      },
    ] as const;
  }

  const [channelId, endpoint, options] = createSubscriptionData();

  beforeEach(async () => {
    storage = TestStorage.create();
    const testLogger = new TestLogger();
    logger = testLogger.setNamespace("SubscriptionHandler");
    loggerMock = testLogger.mock;
    manager = await SubscriptionHandler.create(storage, unsubscribeCallback, logger);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it.todo("reloads subscriptions from storage on create");

  describe("addSubscription", () => {
    it("adds a subscription", async () => {
      const subscription = await manager.addSubscription(channelId, endpoint, options);

      expect(subscription).toBeDefined();
      expect(subscription["endpoint"].toString()).toEqual(endpoint);
      expect(manager["subscriptions"].get(channelId)).toEqual(subscription);
    });
  });

  describe("get", () => {
    beforeEach(async () => {
      await manager.addSubscription(channelId, endpoint, options);
    });

    it("gets a subscription", () => {
      const subscription = manager.get(channelId);
      expect(subscription["endpoint"].toString()).toEqual(endpoint);
    });

    it("throws when subscription is not found", () => {
      expect(() => manager.get(newGuid())).toThrow("Subscription not found");
    });
  });

  describe("getByApplicationServerKey", () => {
    beforeEach(async () => {
      await manager.addSubscription(channelId, endpoint, options);
    });

    it("gets a subscription by application server key", () => {
      const subscription = manager.getByApplicationServerKey(options.applicationServerKey);
      if (!subscription) {
        fail("Subscription not found");
      }
      expect(subscription).toBeDefined();
      expect(subscription["endpoint"].toString()).toEqual(endpoint);
    });

    it("returns undefined when subscription is not found", () => {
      const subscription = manager.getByApplicationServerKey("invalid");
      expect(subscription).toBeUndefined();
    });
  });

  describe("removeSubscription", () => {
    beforeEach(async () => {
      await manager.addSubscription(channelId, endpoint, options);
    });

    it("removes a subscription", async () => {
      await manager.removeSubscription(channelId);
      expect(manager["subscriptions"].get(channelId)).toBeUndefined();
    });

    it("does nothing when subscription is not found", async () => {
      await manager.removeSubscription(newGuid());
      expect(manager["subscriptions"].get(channelId)).toBeDefined();
    });

    it("warns when subscription is not found", async () => {
      const guid = newGuid();
      await manager.removeSubscription(guid);
      expect(loggerMock.warn).toHaveBeenCalledWith(
        expect.stringContaining("Subscription not found"),
        guid,
      );
    });
  });

  describe("removeAllSubscriptions", () => {
    beforeEach(async () => {
      await manager.addSubscription(...createSubscriptionData());
      await manager.addSubscription(...createSubscriptionData());
      await manager.addSubscription(...createSubscriptionData());
    });

    it("removes all subscriptions", async () => {
      await manager.removeAllSubscriptions();
      expect(manager["subscriptions"].size).toBe(0);
    });
  });

  describe("channelIds", () => {
    const data = [createSubscriptionData(), createSubscriptionData(), createSubscriptionData()];
    beforeEach(async () => {
      await Promise.all(data.map((data) => manager.addSubscription(...data)));
    });

    it("gets all channel ids", () => {
      expect(manager.channelIds).toHaveLength(data.length);
      expect(manager.channelIds).toEqual(expect.arrayContaining(data.map(([id]) => id)));
    });
  });
});
