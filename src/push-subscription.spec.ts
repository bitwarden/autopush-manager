import { any, anyString } from "jest-mock-extended";

import { TestLogger } from "../spec/test-logger";
import { TestStorage } from "../spec/test-storage";

import { extractPrivateJwk } from "./crypto";
import { GenericPushSubscription, PushSubscription } from "./push-subscription";
import { fromBufferToUrlB64, joinNamespaces, newUuid } from "./string-manipulation";

const data = {
  channelID: newUuid(),
  endpoint: "https://example.com/",
  options: {
    userVisibleOnly: true,
    applicationServerKey:
      "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  },
};

describe("PushSubscription", () => {
  let storage: TestStorage;
  let logger: TestLogger;
  const unsubscribeCallback = jest.fn();
  let pushSubscription: GenericPushSubscription;

  beforeEach(async () => {
    storage = TestStorage.create();
    logger = new TestLogger();

    pushSubscription = await PushSubscription.create(
      data.channelID,
      storage,
      data.endpoint,
      data.options,
      unsubscribeCallback,
      logger.setNamespace("test"),
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("create", () => {
    it("creates a new subscription", async () => {
      expect(pushSubscription).toBeInstanceOf(PushSubscription);
    });

    it("throws on missing applicationServerKey", async () => {
      await expect(
        PushSubscription.create(
          data.channelID,
          storage,
          data.endpoint,
          { userVisibleOnly: true, applicationServerKey: null as unknown as string },
          unsubscribeCallback,
          logger.setNamespace("test"),
        ),
      ).rejects.toThrow("Only VAPID authenticated subscriptions are supported");
    });

    it("writes the endpoint to storage", async () => {
      expect(await storage.read(joinNamespaces(data.channelID, "endpoint"))).toEqual(data.endpoint);
    });

    it("writes the options to storage", async () => {
      expect(await storage.read(joinNamespaces(data.channelID, "options"))).toEqual({
        userVisibleOnly: data.options.userVisibleOnly,
        applicationServerKey: data.options.applicationServerKey,
      });
    });

    it("writes the keys to storage", async () => {
      await PushSubscription.create(
        data.channelID,
        storage,
        data.endpoint,
        data.options,
        unsubscribeCallback,
        logger.setNamespace("test").extend(data.channelID),
      );

      expect(storage.backing.mock.write).toHaveBeenCalledWith(
        joinNamespaces(data.channelID, "privateEncKey"),
        any(),
      );
    });

    it("writes auth key to storage", async () => {
      await PushSubscription.create(
        data.channelID,
        storage,
        data.endpoint,
        data.options,
        unsubscribeCallback,
        logger.setNamespace("test").extend(data.channelID),
      );

      expect(storage.backing.mock.write).toHaveBeenCalledWith(
        joinNamespaces(data.channelID, "auth"),
        anyString(),
      );
    });

    it("store has all the values", async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const subtle = require("crypto").webcrypto.subtle;
      const prvJwk = await subtle.exportKey("jwk", pushSubscription["keys"].ecKeys.privateKey);

      const expected = new Map([
        [joinNamespaces(data.channelID, "endpoint"), JSON.stringify(data.endpoint)],
        [
          joinNamespaces(data.channelID, "options"),
          JSON.stringify({
            userVisibleOnly: data.options.userVisibleOnly,
            applicationServerKey: data.options.applicationServerKey,
          }),
        ],
        [joinNamespaces(data.channelID, "auth"), JSON.stringify(pushSubscription.getKey("auth"))],
        [joinNamespaces(data.channelID, "privateEncKey"), JSON.stringify(prvJwk)],
      ]);

      expect(storage.backing.store).toEqual(expected);
    });
  });
  describe("recover", () => {
    let recoveredSubscription: GenericPushSubscription;

    beforeEach(async () => {
      recoveredSubscription = await PushSubscription.recover(
        data.channelID,
        storage,
        unsubscribeCallback,
        logger.setNamespace("test").extend(data.channelID),
      );
    });

    it("recovers the subscription", async () => {
      expect(recoveredSubscription).toBeInstanceOf(PushSubscription);
    });

    it("reads the endpoint from storage", async () => {
      expect(recoveredSubscription["endpoint"].toString()).toEqual(data.endpoint);
    });

    it("reads the options from storage", async () => {
      expect(recoveredSubscription["options"]).toEqual(data.options);
    });

    it("reads the auth key from storage", async () => {
      expect(fromBufferToUrlB64(recoveredSubscription["keys"].auth)).toEqual(
        fromBufferToUrlB64(pushSubscription["keys"].auth),
      );
    });

    it("reads the private key from storage", async () => {
      const recoveredJwk = await extractPrivateJwk(recoveredSubscription["keys"].ecKeys);
      const prvJwk = await extractPrivateJwk(pushSubscription["keys"].ecKeys);
      expect(recoveredJwk).toEqual(prvJwk);
    });
  });

  describe("destroy", () => {
    it("removes all keys from storage", async () => {
      await pushSubscription.destroy();
      expect(storage.backing.mock.remove).toHaveBeenCalledWith(
        joinNamespaces(data.channelID, "endpoint"),
      );
      expect(storage.backing.mock.remove).toHaveBeenCalledWith(
        joinNamespaces(data.channelID, "options"),
      );
      expect(storage.backing.mock.remove).toHaveBeenCalledWith(
        joinNamespaces(data.channelID, "auth"),
      );
      expect(storage.backing.mock.remove).toHaveBeenCalledWith(
        joinNamespaces(data.channelID, "privateEncKey"),
      );
    });
  });

  describe("toJSON", () => {
    it("returns the endpoint", () => {
      expect(pushSubscription.toJSON().endpoint).toEqual(data.endpoint);
    });

    it("returns null expiration time", () => {
      expect(pushSubscription.toJSON().expirationTime).toEqual(null);
    });

    it("returns the auth key", async () => {
      expect(pushSubscription.toJSON().keys.auth).toEqual(
        fromBufferToUrlB64(pushSubscription["keys"].auth),
      );
    });

    it("returns the public key", async () => {
      expect(pushSubscription.toJSON().keys.p256dh).toEqual(
        fromBufferToUrlB64(pushSubscription["keys"].ecKeys.uncompressedPublicKey),
      );
    });
  });

  describe("getKey", () => {
    it("returns the auth key", async () => {
      expect(pushSubscription.getKey("auth")).toEqual(
        fromBufferToUrlB64(pushSubscription["keys"].auth),
      );
    });

    it("returns the public key", async () => {
      expect(pushSubscription.getKey("p256dh")).toEqual(
        fromBufferToUrlB64(pushSubscription["keys"].ecKeys.uncompressedPublicKey),
      );
    });
  });

  describe("unsubscribe", () => {
    it("calls the unsubscribe callback", async () => {
      await pushSubscription.unsubscribe();

      expect(unsubscribeCallback).toHaveBeenCalled();
    });
  });

  describe("addEventListener", () => {
    it("adds an event listener for the notification event", () => {
      const listener = jest.fn();
      pushSubscription.addEventListener("notification", listener);

      //trigger event
      pushSubscription["eventManager"].dispatchEvent("notification", "data");

      expect(listener).toHaveBeenCalledWith("data");
    });
  });

  describe("removeEventListener", () => {
    it("removes an event listener for the notification event", () => {
      const listener = jest.fn();
      const listenerId = pushSubscription.addEventListener("notification", listener);

      pushSubscription.removeEventListener("notification", listenerId);

      //trigger event
      pushSubscription["eventManager"].dispatchEvent("notification", "data");

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
