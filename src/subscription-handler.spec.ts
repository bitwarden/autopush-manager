import { mock, MockProxy } from "jest-mock-extended";

import { applicationPublicKey } from "../spec/constants";
import { TestLogger } from "../spec/test-logger";
import { TestStorage } from "../spec/test-storage";

import { Logger, NamespacedLogger } from "./logger";
import { MessageMediator } from "./messages/message-mediator";
import { GenericPushSubscription } from "./push-subscription";
import { newUuid } from "./string-manipulation";
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
      newUuid(),
      "https://example.com/" + subCount,
      {
        userVisibleOnly: true,
        applicationServerKey: applicationPublicKey.substring(0, 65) + subCount++,
      },
    ] as const;
  }

  function createMockSubscription() {
    return mock<GenericPushSubscription>();
  }

  const [channelID, endpoint, options] = createSubscriptionData();

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
      const subscription = await manager.addSubscription(channelID, endpoint, options);

      expect(subscription).toBeDefined();
      expect(subscription["endpoint"].toString()).toEqual(endpoint);
      expect(manager["subscriptions"].get(channelID)).toEqual(subscription);
    });
  });

  describe("get", () => {
    beforeEach(async () => {
      await manager.addSubscription(channelID, endpoint, options);
    });

    it("gets a subscription", () => {
      const subscription = manager.get(channelID);
      if (!subscription) {
        fail("Subscription not found");
      }
      expect(subscription["endpoint"].toString()).toEqual(endpoint);
    });

    it("is null when subscription is not found", () => {
      expect(manager.get(newUuid())).toBeNull();
    });
  });

  describe("getByApplicationServerKey", () => {
    beforeEach(async () => {
      await manager.addSubscription(channelID, endpoint, options);
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
      await manager.addSubscription(channelID, endpoint, options);
    });

    it("removes a subscription", async () => {
      await manager.removeSubscription(channelID);
      expect(manager["subscriptions"].get(channelID)).toBeUndefined();
    });

    it("does nothing when subscription is not found", async () => {
      await manager.removeSubscription(newUuid());
      expect(manager["subscriptions"].get(channelID)).toBeDefined();
    });

    it("warns when subscription is not found", async () => {
      const uuid = newUuid();
      await manager.removeSubscription(uuid);
      expect(loggerMock.warn).toHaveBeenCalledWith(
        expect.stringContaining("Subscription not found"),
        uuid,
      );
    });
  });

  describe("reInitAllSubscriptions", () => {
    beforeEach(async () => {
      manager["subscriptions"].set(newUuid(), createMockSubscription());
      manager["subscriptions"].set(newUuid(), createMockSubscription());
      manager["subscriptions"].set(newUuid(), createMockSubscription());
    });

    it("reInits all subscriptions", async () => {
      await manager.reInitAllSubscriptions(mock<MessageMediator>());
      for (const subscription of manager["subscriptions"].values()) {
        expect(subscription.reInit).toHaveBeenCalled();
      }
    });

    it("deletes all old subscriptions", async () => {
      const existingIds = manager.channelIDs;
      await manager.reInitAllSubscriptions(mock<MessageMediator>());
      for (const channelID of existingIds) {
        expect(manager["subscriptions"].get(channelID)).toBeUndefined();
      }
    });
  });

  describe("channelIDs", () => {
    const data = [createSubscriptionData(), createSubscriptionData(), createSubscriptionData()];
    beforeEach(async () => {
      await Promise.all(data.map((data) => manager.addSubscription(...data)));
    });

    it("gets all channel ids", () => {
      expect(manager.channelIDs).toHaveLength(data.length);
      expect(manager.channelIDs).toEqual(expect.arrayContaining(data.map(([id]) => id)));
    });
  });
});
