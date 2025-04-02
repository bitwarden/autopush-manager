import * as crypto from "crypto";

import { createPushManager } from "..";
import { deriveKeyAndNonce, generateEcKeys, randomBytes } from "../src/crypto";
import { ClientAck, ClientAckCodes } from "../src/messages/message";
import { PushManager } from "../src/push-manager";
import { GenericPushSubscription } from "../src/push-subscription";
import {
  fromBufferToUrlB64,
  fromUrlB64ToBuffer,
  fromUtf8ToBuffer,
} from "../src/string-manipulation";

import {
  applicationPrivateKey,
  applicationPublicKey,
  applicationPublicKeyX,
  applicationPublicKeyY,
} from "./constants";
import { TestLogger } from "./test-logger";
import { TestBackingStore } from "./test-storage";
import { defaultUaid, helloHandlerWithUaid, TestWebSocketServer } from "./test-websocket-server";

const port = 1234;
const url = "ws://localhost:" + port;

describe("end to end", () => {
  let storage: TestBackingStore;
  let logger: TestLogger;
  let server: TestWebSocketServer;
  let pushManager: PushManager;

  beforeAll(() => {
    server = new TestWebSocketServer(port);
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    storage = new TestBackingStore();
    logger = new TestLogger();
  });

  afterEach(async () => {
    await pushManager?.destroy();
    // ensure the server is using the default handlers
    server.useDefaultHandlers();
    // ensure we don't leak connections between tests
    server.closeClients();
  });

  describe("reconnection", () => {
    beforeEach(async () => {
      pushManager = await createPushManager(storage, logger, {
        autopushUrl: url,
        // Set reconnect to occur after 10ms
        reconnectDelay: () => new Promise((resolve) => setTimeout(resolve, 10)),
      });
    });

    async function closeWebSocket() {
      const client = server.clients[0];
      client.ws.close();
      await new Promise<void>((resolve) => {
        client.ws.on("close", resolve);
      });
      return client;
    }

    it("reconnects when the connection is closed", async () => {
      const previousClient = await closeWebSocket();

      // TODO: better await for reconnect
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 1000);
      });

      expect(server.clients).toHaveLength(1);
      expect(server.clients[0]).not.toBe(previousClient);
    });

    it("maintains event subscriptions after reconnect", async () => {
      const sub = await pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationPublicKey,
      });

      const notificationSpy = jest.fn();
      const notificationPromise = new Promise<void>((resolve, reject) => {
        sub.addEventListener("notification", (d) => {
          notificationSpy(d);
          resolve();
        });
        setTimeout(reject, 1000);
      });

      await closeWebSocket();

      // TODO: better await for reconnect
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 500);
      });

      server.sendNotification(sub.channelID);

      await notificationPromise;
      expect(notificationSpy).toHaveBeenCalled();
    });

    it("maintains event subscriptions after reconnect and a new uaid", async () => {
      const newUaid = "new-uaid";
      server.helloHandler = helloHandlerWithUaid(newUaid);

      const sub = await pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationPublicKey,
      });

      const notificationSpy = jest.fn();
      const notificationPromise = new Promise<void>((resolve, reject) => {
        sub.addEventListener("notification", (d) => {
          notificationSpy(d);
          resolve();
        });
        setTimeout(reject, 1000);
      });

      await closeWebSocket();

      // TODO: better await for reconnect
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 500);
      });

      expect(server.identifiedClients[0].uaid).toEqual(newUaid);

      server.sendNotification(sub.channelID);

      await notificationPromise;
      expect(notificationSpy).toHaveBeenCalled();
    });
  });

  describe("Hello", () => {
    it("connects to the server", async () => {
      pushManager = await createPushManager(storage, logger, { autopushUrl: url });
      expect(server.clients).toHaveLength(1);
    });

    it("immediately sends a hello message", async () => {
      pushManager = await createPushManager(storage, logger, { autopushUrl: url });
      const client = server.clients[0];
      expect(client).toHaveReceived(expect.objectContaining({ messageType: "hello" }));
    });

    it("sends a hello message with the correct uaid", async () => {
      await storage.write("uaid", JSON.stringify("test-uaid"));
      pushManager = await createPushManager(storage, logger, { autopushUrl: url });
      const client = server.clients[0];
      expect(client).toHaveReceived({
        messageType: "hello",
        uaid: "test-uaid",
        channelIDs: [],
        use_webpush: true,
      });
    });

    it("records the correct uaid to storage", async () => {
      pushManager = await createPushManager(storage, logger, { autopushUrl: url });
      expect(storage.mock.write).toHaveBeenCalledWith("uaid", JSON.stringify(defaultUaid));
      // await expect(storage.read("uaid")).resolves.toEqual(defaultUaid);
    });

    it("updates uaid in storage when a new one is received", async () => {
      await storage.write("uaid", JSON.stringify("test-uaid"));
      pushManager = await createPushManager(storage, logger, { autopushUrl: url });
      const client = server.clients[0];
      expect(client).toHaveReceived({
        messageType: "hello",
        uaid: "test-uaid",
        channelIDs: [],
        use_webpush: true,
      });
    });

    describe("existing subscriptions", () => {
      beforeEach(async () => {
        // Set up existing storage
        await storage.write("channelIDs", JSON.stringify(["f2ca74ee-d688-4cb2-8ae1-9deb4805be29"]));
        await storage.write(
          "f2ca74ee-d688-4cb2-8ae1-9deb4805be29:endpoint",
          JSON.stringify("https://example.com/push//f2ca74ee-d688-4cb2-8ae1-9deb4805be29"),
        );
        await storage.write(
          "f2ca74ee-d688-4cb2-8ae1-9deb4805be29:options",
          JSON.stringify({
            userVisibleOnly: true,
            applicationServerKey: applicationPublicKey,
          }),
        );
        await storage.write(
          "f2ca74ee-d688-4cb2-8ae1-9deb4805be29:auth",
          JSON.stringify("kKZ96yjFVbvnUa458DDWNg"),
        );
        await storage.write(
          "f2ca74ee-d688-4cb2-8ae1-9deb4805be29:privateEncKey",
          JSON.stringify({
            key_ops: ["deriveKey", "deriveBits"],
            ext: true,
            kty: "EC",
            x: applicationPublicKeyX,
            y: applicationPublicKeyY,
            crv: "P-256",
            d: applicationPrivateKey,
          }),
        );
      });

      it("reconnects existing channels", async () => {
        // Same Uaid as response
        await storage.write("uaid", JSON.stringify(defaultUaid));

        pushManager = await createPushManager(storage, logger, { autopushUrl: url });
        const client = server.clients[0];
        expect(client).toHaveReceived({
          messageType: "hello",
          uaid: "5f0774ac-09a3-45d9-91e4-f4aaebaeec72",
          channelIDs: ["f2ca74ee-d688-4cb2-8ae1-9deb4805be29"],
          use_webpush: true,
        });
      });
    });
  });

  describe("Notification", () => {
    let sub: GenericPushSubscription;

    beforeEach(async () => {
      pushManager = await createPushManager(storage, logger, {
        autopushUrl: url,
        ackIntervalMs: 100,
      });
      sub = await pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationPublicKey,
      });
    });

    it("sends a notification", async () => {
      const notifiedSpy = jest.fn();
      const notifiedCalled = new Promise<void>((resolve, reject) => {
        sub.addEventListener("notification", (data) => {
          notifiedSpy(data);
          resolve();
        });
        setTimeout(() => reject(), 1000);
      });

      server.sendNotification(sub.channelID);
      await notifiedCalled;

      expect(notifiedSpy).toHaveBeenCalledWith(null);
    });

    it("sends a notification message", async () => {
      const notifiedSpy = jest.fn();
      const notifiedCalled = new Promise<void>((resolve, reject) => {
        sub.addEventListener("notification", (data) => {
          notifiedSpy(data);
          resolve();
        });
        setTimeout(() => reject(), 1000);
      });

      const data = "some data";
      const encrypted = await aes128GcmEncrypt(data, sub);

      server.sendNotification(sub.channelID, encrypted, { encoding: "aes128gcm" });
      const client = server.identifiedClientFor(sub.channelID);
      if (!client) {
        fail("Client not found");
      }

      await notifiedCalled;

      expect(notifiedSpy).toHaveBeenCalledWith("some data");
    });

    it("sends acks when notifications are received", async () => {
      const ackPromise = new Promise<void>((resolve, reject) => {
        server.ackHandler = () => resolve();
        setTimeout(() => reject(), 1000);
      });

      const version = server.sendNotification(sub.channelID);

      const expectedAck: ClientAck = {
        messageType: "ack",
        updates: [{ channelID: sub.channelID, version, code: ClientAckCodes.SUCCESS }],
      };

      await expect(ackPromise).resolves.toBeUndefined();

      const client = server.identifiedClientFor(sub.channelID);
      if (!client) {
        fail("Client not found");
      }
      expect(client).toHaveReceived(expectedAck);
    });

    it("acks decryption errors", async () => {
      const ackPromise = new Promise<void>((resolve, reject) => {
        server.ackHandler = () => resolve();
        setTimeout(() => reject(), 1000);
      });

      const version = server.sendNotification(sub.channelID, "This should have been encrypted", {
        encoding: "aes128gcm",
      });

      const expectedAck: ClientAck = {
        messageType: "ack",
        updates: [{ channelID: sub.channelID, version, code: ClientAckCodes.DECRYPT_FAIL }],
      };

      await expect(ackPromise).resolves.toBeUndefined();

      const client = server.identifiedClientFor(sub.channelID);
      if (!client) {
        fail("Client not found");
      }
      expect(client).toHaveReceived(expectedAck);
    });

    it("groups acks together", async () => {
      const ackPromise = new Promise<void>((resolve, reject) => {
        server.ackHandler = () => resolve();
        setTimeout(() => reject(), 1000);
      });

      const version1 = server.sendNotification(sub.channelID);
      const version2 = server.sendNotification(sub.channelID);

      const expectedAck: ClientAck = {
        messageType: "ack",
        updates: [
          { channelID: sub.channelID, version: version1, code: ClientAckCodes.SUCCESS },
          { channelID: sub.channelID, version: version2, code: ClientAckCodes.SUCCESS },
        ],
      };

      await expect(ackPromise).resolves.toBeUndefined();

      const client = server.identifiedClientFor(sub.channelID);
      if (!client) {
        fail("Client not found");
      }
      expect(client).toHaveReceived(expectedAck);
    });

    it("groups acks togher across subscriptions", async () => {
      const sub2 = await pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationPublicKey,
      });

      const ackPromise = new Promise<void>((resolve, reject) => {
        server.ackHandler = () => resolve();
        setTimeout(() => reject(), 1000);
      });

      const version1 = server.sendNotification(sub.channelID);
      const version2 = server.sendNotification(sub2.channelID);

      const expectedAck: ClientAck = {
        messageType: "ack",
        updates: [
          { channelID: sub.channelID, version: version1, code: ClientAckCodes.SUCCESS },
          { channelID: sub2.channelID, version: version2, code: ClientAckCodes.SUCCESS },
        ],
      };

      await expect(ackPromise).resolves.toBeUndefined();

      const client = server.identifiedClientFor(sub.channelID);
      if (!client) {
        fail("Client not found");
      }
      expect(client).toHaveReceived(expectedAck);
    });
  });
});

const recordSize = new Uint8Array([0, 0, 4, 0]);
const keyLength = new Uint8Array([65]);
async function aes128GcmEncrypt(data: string, sub: GenericPushSubscription) {
  const paddedData = Buffer.concat([fromUtf8ToBuffer(data), new Uint8Array([2, 0, 0, 0, 0])]);
  const salt = await randomBytes(16);
  const ecKeys = await generateEcKeys();
  const { contentEncryptionKey, nonce } = await deriveKeyAndNonce(
    {
      publicKey: sub.getKey("p256dhBuffer"),
    },
    {
      publicKey: ecKeys.uncompressedPublicKey,
      privateKey: ecKeys.privateKey,
    },
    fromUrlB64ToBuffer(sub.getKey("auth")),
    salt,
  );

  const cryptoKey = crypto.createSecretKey(Buffer.from(contentEncryptionKey));
  const cipher = crypto.createCipheriv("aes-128-gcm", cryptoKey, Buffer.from(nonce));
  const encrypted = cipher.update(paddedData);
  cipher.final();
  const authTag = cipher.getAuthTag();
  const result = Buffer.concat([
    salt,
    recordSize,
    keyLength,
    new Uint8Array(ecKeys.uncompressedPublicKey),
    encrypted,
    authTag,
  ]);

  return fromBufferToUrlB64(result);
}
