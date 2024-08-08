import type { Jsonify } from "type-fest";

import {
  aesGcmDecrypt,
  generateEcKeys,
  randomBytes,
  parsePrivateJwk,
  extractPrivateJwk,
  webPushDecryptPrep,
  removePadding,
} from "./crypto";
import {
  CsprngArray,
  ECKeyPair,
  EncodedSymmetricKey,
  EncodedUncompressedPublicKey,
  UncompressedPublicKey,
} from "./crypto-types";
import { EventManager, ListenerId } from "./event-manager";
import { NamespacedLogger } from "./logger";
import { RegisterHandler } from "./messages/handlers/register-handler";
import { ClientAckCodes, ServerNotification } from "./messages/message";
import { MessageMediator } from "./messages/message-mediator";
import { RegisterSender } from "./messages/senders/register-sender";
import { Storage } from "./storage";
import {
  Uuid,
  JoinStrings,
  fromBufferToUtf8,
  fromBufferToUrlB64,
  fromUrlB64ToBuffer,
} from "./string-manipulation";

type SubscriptionKeys = {
  auth: CsprngArray;
  ecKeys: ECKeyPair;
};

type TKey<T extends "auth" | "p256dh" | "p256dhBuffer"> = T extends "auth"
  ? EncodedSymmetricKey
  : T extends "p256dh"
    ? EncodedUncompressedPublicKey
    : UncompressedPublicKey;

const STORAGE_KEYS = Object.freeze({
  endpoint: "endpoint",
  options: "options",
  privateEncKey: "privateEncKey",
  auth: "auth",
} as const);

export type PublicPushSubscription = {
  addEventListener<K extends keyof PushSubscriptionEvents>(
    type: K,
    listener: PushSubscriptionEvents[K],
  ): ListenerId;
  removeEventListener<K extends keyof PushSubscriptionEvents>(
    type: K,
    listenerId: ListenerId,
  ): void;
  unsubscribe(): Promise<void>;
  getKey(key: "auth" | "p256dh"): string;
  toJSON(): {
    endpoint: string;
    expirationTime: Date | null;
    keys: {
      auth: string;
      p256dh: string;
    };
  };
};

export type PushSubscriptionEvents = {
  notification: (data: string | null) => void;
  pushsubscriptionchange: (newSubscription: Jsonify<PushSubscription>) => void;
};

export type GenericPushSubscription = PushSubscription<Uuid, JoinStrings<string, Uuid>>;
export class PushSubscription<
  const TChannelId extends Uuid = Uuid,
  TNamespace extends JoinStrings<string, TChannelId> = JoinStrings<"", TChannelId>,
> implements PublicPushSubscription
{
  private readonly eventManager: EventManager<PushSubscriptionEvents>;
  constructor(
    readonly channelID: TChannelId,
    private readonly storage: Storage<TNamespace>,
    private readonly endpoint: URL,
    private readonly keys: SubscriptionKeys,
    readonly options: PushSubscriptionOptions,
    private readonly unsubscribeCallback: () => Promise<void>,
    private readonly logger: NamespacedLogger<TNamespace>,
    eventManager?: EventManager<PushSubscriptionEvents>,
  ) {
    if (eventManager) {
      // this is a reinit, we need to notify
      eventManager.dispatchEvent("pushsubscriptionchange", this.toJSON());
    }
    this.eventManager = eventManager ?? new EventManager(logger.extend("EventManager"));
  }

  /**
   * Handles a notification message.
   *
   * Authenticates the deliverer, decrypts the message, and dispatches the decrypted data as a `notification` event.
   *
   * If no message data is present, dispatches a null `notification` event.
   * @param message
   *
   * @throws {ClientAckCodes.OTHER_FAIL} if the message is missing headers
   * @throws {ClientAckCodes.OTHER_FAIL} if the message is missing an Authorization header
   * @throws {ClientAckCodes.DECRYPT_FAIL} if the message contains data, but is missing headers required to decrypt
   * @throws {ClientAckCodes.DECRYPT_FAIL} if message data decryption fails
   */
  async handleNotification(message: ServerNotification) {
    this.logger.debug("Handling notification", message);

    // FIXME: Do we need to validate authorization, or is this handled by autopush?
    // if (
    //   !message.headers ||
    //   !message.headers["Authorization"] ||
    //   !(await verifyVapidAuth(this.options.applicationServerKey, message.headers["Authorization"]))
    // ) {
    //   this.logger.error("Invalid authorization header", message);
    //   throw ClientAckCodes.OTHER_FAIL;
    // }

    if (!message.data) {
      this.logger.debug("Notification has no data", message);
      this.eventManager.dispatchEvent("notification", null);
      return;
    }

    // Decrypt Message
    if (
      !message.headers ||
      (message.headers["encoding"] !== "aes128gcm" &&
        message.headers["Content-Encoding"] !== "aes128gcm")
    ) {
      this.logger.error("Unsupported encoding", message);
      throw ClientAckCodes.DECRYPT_FAIL;
    }

    let decryptedContent: Uint8Array;
    try {
      const { contentEncryptionKey, nonce, encryptedContent } = await webPushDecryptPrep(
        { keys: this.keys.ecKeys, secret: this.keys.auth },
        fromUrlB64ToBuffer(message.data),
      );

      const decrypted = await aesGcmDecrypt(encryptedContent, contentEncryptionKey, nonce);

      // Remove padding
      decryptedContent = removePadding(new Uint8Array(decrypted), true); // always last record: only one supported
    } catch (e) {
      this.logger.error("Error decrypting notification", e);
      throw ClientAckCodes.DECRYPT_FAIL;
    }

    this.eventManager.dispatchEvent("notification", fromBufferToUtf8(decryptedContent));
    this.logger.debug("Handled notification", message);
  }

  static async create<const T extends Uuid>(
    channelID: T,
    storage: Storage<string>,
    endpoint: string,
    options: PushSubscriptionOptions,
    unsubscribeCallback: () => Promise<void>,
    logger: NamespacedLogger<string>,
    eventManager?: EventManager<PushSubscriptionEvents>,
  ) {
    if (!options.applicationServerKey) {
      throw new Error("Only VAPID authenticated subscriptions are supported");
    }
    const subscriptionStorage = storage.extend(channelID);
    // Throws on invalid endpoint
    const urlEndpoint = new URL(endpoint);

    await subscriptionStorage.write(STORAGE_KEYS.endpoint, endpoint);
    await subscriptionStorage.write(STORAGE_KEYS.options, {
      userVisibleOnly: options.userVisibleOnly,
      applicationServerKey: options.applicationServerKey,
    });

    const keys = await PushSubscription.generateKeys(subscriptionStorage);
    return new PushSubscription(
      channelID,
      subscriptionStorage,
      urlEndpoint,
      keys,
      options,
      unsubscribeCallback,
      logger.extend(channelID),
      eventManager,
    );
  }

  static async recover<const T extends Uuid>(
    channelID: T,
    storage: Storage<string>,
    unsubscribeCallback: () => Promise<void>,
    logger: NamespacedLogger<string>,
  ) {
    const subscriptionStorage = storage.extend(channelID);
    const keys = await PushSubscription.readKeys(subscriptionStorage);
    if (!keys) {
      throw new Error("No keys found for channel");
    }
    const serializedOptions = await subscriptionStorage.read<PushSubscriptionOptions>(
      STORAGE_KEYS.options,
    );
    if (!serializedOptions) {
      throw new Error("No options found for channel");
    }
    const endpoint = await subscriptionStorage.read<string>(STORAGE_KEYS.endpoint);
    if (!endpoint) {
      throw new Error("No endpoint found for channel");
    }
    const urlEndpoint = new URL(endpoint);

    return new PushSubscription(
      channelID,
      subscriptionStorage,
      urlEndpoint,
      keys,
      serializedOptions,
      unsubscribeCallback,
      logger.extend(channelID),
    );
  }

  async reInit(mediator: MessageMediator) {
    const handler = mediator.getHandler(RegisterHandler);
    if (!handler) {
      throw new Error("RegisterHandler not found, cannot complete registration.");
    }

    const promise = handler.awaitRegister(this.options.applicationServerKey);
    await mediator.send(RegisterSender, { options: this.options, eventManager: this.eventManager });
    const pushSubscription = await promise;
    return pushSubscription;
  }

  async destroy() {
    for (const key of Object.values(STORAGE_KEYS)) {
      await this.storage.remove(key);
    }
  }

  private static async readKeys<const T extends string>(
    storage: Storage<T>,
  ): Promise<SubscriptionKeys | null> {
    const storedAuth = await storage.read<EncodedSymmetricKey>(STORAGE_KEYS.auth);
    const jwk = await storage.read<Jsonify<JsonWebKey>>(STORAGE_KEYS.privateEncKey);
    const ecKeys = await parsePrivateJwk(jwk);
    if (!storedAuth || !ecKeys) {
      return null;
    }
    return {
      auth: fromUrlB64ToBuffer(storedAuth) as CsprngArray,
      ecKeys,
    };
  }

  private static async generateKeys<const T extends string>(
    storage: Storage<T>,
  ): Promise<SubscriptionKeys> {
    const auth = await randomBytes(16);
    const ecKeys = await generateEcKeys();
    await storage.write(STORAGE_KEYS.auth, fromBufferToUrlB64(auth));
    const jwk = await extractPrivateJwk(ecKeys);
    await storage.write(STORAGE_KEYS.privateEncKey, jwk as Jsonify<JsonWebKey>);

    return {
      auth,
      ecKeys,
    };
  }

  toJSON() {
    return {
      endpoint: this.endpoint.toString(),
      expirationTime: null, // FIXME: It's not clear where this expiration time comes from
      keys: {
        auth: this.getKey("auth"),
        p256dh: this.getKey("p256dh"),
      },
    };
  }

  getKey<const T extends "auth" | "p256dh" | "p256dhBuffer">(name: T): TKey<T> {
    switch (name) {
      case "auth":
        return fromBufferToUrlB64(this.keys.auth) as TKey<T>;
      case "p256dh":
        return fromBufferToUrlB64(this.keys.ecKeys.uncompressedPublicKey) as TKey<T>;
      default:
        return this.keys.ecKeys.uncompressedPublicKey as TKey<T>;
    }
  }

  unsubscribe(): Promise<void> {
    return this.unsubscribeCallback();
  }

  addEventListener<K extends keyof PushSubscriptionEvents>(
    type: K,
    listener: PushSubscriptionEvents[K],
  ): ListenerId {
    return this.eventManager.addEventListener(type, listener);
  }

  removeEventListener<K extends keyof PushSubscriptionEvents>(type: K, listenerId: ListenerId) {
    this.eventManager.removeEventListener(type, listenerId);
  }
}

export type PushSubscriptionOptions = {
  userVisibleOnly: boolean;
  applicationServerKey: string;
};
