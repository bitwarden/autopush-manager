import * as crypto from "crypto";

import { createPushManager } from "../src";
import { deriveKeyAndNonce, generateEcKeys, randomBytes } from "../src/crypto";
import { PushManager } from "../src/push-manager";
import { GenericPushSubscription } from "../src/push-subscription";
import {
  fromBufferToUrlB64,
  fromUrlB64ToBuffer,
  fromUtf8ToBuffer,
} from "../src/string-manipulation";

import { applicationPublicKey } from "./constants";
import { TestLogger } from "./test-logger";
import { TestBackingStore } from "./test-storage";
import { defaultUaid, TestWebSocketServer } from "./test-websocket-server";

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
    // ensure we don't leak connections between tests
    server.closeClients();
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
  });

  describe("Notification", () => {
    it("sends a notification", async () => {
      pushManager = await createPushManager(storage, logger, { autopushUrl: url });
      const sub = await pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationPublicKey,
      });
      const notifiedSpy = jest.fn();
      const notifiedCalled = new Promise<void>((resolve) => {
        sub.addEventListener("notification", (data) => {
          notifiedSpy(data);
          resolve();
        });
      });

      server.sendNotification(sub.channelID);
      await notifiedCalled;

      expect(notifiedSpy).toHaveBeenCalledWith(null);
    });

    it("sends a notification message", async () => {
      pushManager = await createPushManager(storage, logger, { autopushUrl: url });
      const sub = await pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationPublicKey,
      });
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
