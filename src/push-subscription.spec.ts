import { any, anyString } from "jest-mock-extended";

import { TestLogger } from "../spec/test-logger";
import { TestStorage } from "../spec/test-storage";

import { extractPrivateJwk } from "./crypto";
import { GenericPushSubscription, PushSubscription } from "./push-subscription";
import { fromBufferToUrlB64, newGuid } from "./string-manipulation";

describe("PushSubscription", () => {
  const data = {
    channelId: newGuid(),
    endpoint: "https://example.com/",
    options: {
      userVisibleOnly: true,
      applicationServerKey:
        "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
    },
  };
  let storage: TestStorage;
  let logger: TestLogger;
  const unsubscribeCallback = jest.fn();
  let pushSubscription: GenericPushSubscription;

  beforeEach(async () => {
    storage = TestStorage.create();
    logger = new TestLogger();

    pushSubscription = await PushSubscription.create(
      data.channelId,
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
          data.channelId,
          storage.setNamespace(data.channelId),
          data.endpoint,
          { userVisibleOnly: true, applicationServerKey: null as unknown as string },
          unsubscribeCallback,
          logger.setNamespace("test").extend(data.channelId),
        ),
      ).rejects.toThrow("Only VAPID authenticated subscriptions are supported");
    });

    it("writes the endpoint to storage", async () => {
      expect(await storage.read("endpoint")).toEqual(data.endpoint);
    });

    it("writes the options to storage", async () => {
      expect(await storage.read("options")).toEqual({
        userVisibleOnly: data.options.userVisibleOnly,
        applicationServerKey: data.options.applicationServerKey,
      });
    });

    it("writes the keys to storage", async () => {
      await PushSubscription.create(
        data.channelId,
        storage,
        data.endpoint,
        data.options,
        unsubscribeCallback,
        logger.setNamespace("test").extend(data.channelId),
      );

      expect(storage.mock.write).toHaveBeenCalledWith("privateEncKey", any());
    });

    it("writes auth key to storage", async () => {
      await PushSubscription.create(
        data.channelId,
        storage,
        data.endpoint,
        data.options,
        unsubscribeCallback,
        logger.setNamespace("test").extend(data.channelId),
      );

      expect(storage.mock.write).toHaveBeenCalledWith("auth", anyString());
    });

    it("store has all the values", async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const subtle = require("crypto").webcrypto.subtle;
      const prvJwk = await subtle.exportKey("jwk", pushSubscription["keys"].ecKeys.privateKey);

      expect(storage.store).toEqual(
        new Map(
          Object.entries({
            endpoint: data.endpoint,
            options: data.options,
            auth: pushSubscription.getKey("auth"),
            privateEncKey: prvJwk,
          }),
        ),
      );
    });
  });

  describe("recover", () => {
    let recoveredSubscription: PushSubscription<typeof data.channelId>;

    beforeEach(async () => {
      recoveredSubscription = await PushSubscription.recover(
        storage.setNamespace(data.channelId),
        unsubscribeCallback,
        logger.setNamespace("test").extend(data.channelId),
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
    // it("removes all keys from storage", async () => {
    //   await pushSubscription.destroy();
    //   expect(await storage.read("endpoint")).toBeUndefined();
    //   expect(await storage.read("options")).toBeUndefined();
    // });
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
