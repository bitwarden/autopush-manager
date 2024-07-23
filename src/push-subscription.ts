import {
  CsprngArray,
  ECKeyPair,
  EncodedSymmetricKey,
  EncodedUncompressedPublicKey,
} from "./crypto-types";
import { EventManager } from "./event-manager";
import { NamespacedLogger } from "./logger";
import { ServerNotification } from "./messages/message";
import { NamespacedStorage } from "./storage";
import {
  fromB64ToBuffer,
  fromBufferToUrlB64,
  generateEcKeys,
  Guid,
  JoinStrings,
  randomBytes,
  readEcKeys,
  writeEcKeys,
} from "./util";

type SubscriptionKeys = {
  auth: CsprngArray;
  ecKeys: ECKeyPair;
};

type TKey<T extends "auth" | "p256dh"> = T extends "auth"
  ? EncodedSymmetricKey
  : EncodedUncompressedPublicKey;

const STORAGE_KEYS = Object.freeze({
  endpoint: "endpoint",
  options: "options",
  privateEcKey: "privateEcKey",
  auth: "auth",
} as const);

export type PublicPushSubscription = {
  toJSON(): {
    endpoint: string;
    expirationTime: Date | null;
    keys: {
      auth: string;
      p256dh: string;
    };
  };

  getKey(key: "auth" | "p256dh"): string;
  unsubscribe(): Promise<void>;
};

export class PushSubscription<const TChannelId extends Guid> implements PublicPushSubscription {
  private readonly eventManager: EventManager<{ notification: (data: string | null) => void }>;
  public constructor(
    private readonly storage: NamespacedStorage<TChannelId>,
    private readonly endpoint: URL,
    private readonly keys: SubscriptionKeys,
    public readonly options: PushSubscriptionOptions,
    private readonly unsubscribeCallback: () => Promise<void>,
    private readonly logger: NamespacedLogger<JoinStrings<string, TChannelId>>
  ) {
    this.eventManager = new EventManager(logger.extend("EventManager"));
  }

  public async handleNotification(message: ServerNotification) {
    this.logger.debug("Handling notification", message);
    // TODO authenticate
    // TODO decrypt
    this.eventManager.dispatchEvent("notification", message.data);
    this.logger.debug("Handled notification", message);
  }

  public static async create<const T extends Guid>(
    storage: NamespacedStorage<T>,
    endpoint: string,
    options: PushSubscriptionOptions,
    unsubscribeCallback: () => Promise<void>,
    logger: NamespacedLogger<JoinStrings<string, T>>
  ) {
    if (!options.applicationServerKey) {
      throw new Error("Only VAPID authenticated subscriptions are supported");
    }
    // Throws on invalid endpoint
    const urlEndpoint = new URL(endpoint);

    await storage.write(STORAGE_KEYS.endpoint, endpoint);
    await storage.write(STORAGE_KEYS.options, {
      userVisibleOnly: options.userVisibleOnly,
      applicationServerKey: options.applicationServerKey,
    });

    const keys = await PushSubscription.generateKeys(storage);
    return new PushSubscription(storage, urlEndpoint, keys, options, unsubscribeCallback, logger);
  }

  public static async recover<const T extends Guid>(
    storage: NamespacedStorage<T>,
    unsubscribeCallback: () => Promise<void>,
    logger: NamespacedLogger<JoinStrings<string, T>>
  ) {
    const keys = await PushSubscription.readKeys(storage);
    if (!keys) {
      throw new Error("No keys found for channel");
    }
    const serializedOptions = await storage.read<PushSubscriptionOptions>(STORAGE_KEYS.options);
    if (!serializedOptions) {
      throw new Error("No options found for channel");
    }
    const endpoint = await storage.read<string>(STORAGE_KEYS.endpoint);
    if (!endpoint) {
      throw new Error("No endpoint found for channel");
    }
    const urlEndpoint = new URL(endpoint);

    return new PushSubscription(
      storage,
      urlEndpoint,
      keys,
      serializedOptions,
      unsubscribeCallback,
      logger
    );
  }

  public async destroy() {
    for (const key of Object.values(STORAGE_KEYS)) {
      await this.storage.remove(key);
    }
  }

  private static async readKeys<const T extends string>(
    storage: NamespacedStorage<T>
  ): Promise<SubscriptionKeys | null> {
    const storedAuth = await storage.read<EncodedSymmetricKey>(STORAGE_KEYS.auth);
    const ecKeys = await readEcKeys(storage, STORAGE_KEYS.privateEcKey);
    if (!storedAuth || !ecKeys) {
      return null;
    }
    return {
      auth: fromB64ToBuffer(storedAuth) as CsprngArray,
      ecKeys,
    };
  }

  private static async generateKeys<const T extends string>(
    storage: NamespacedStorage<T>
  ): Promise<SubscriptionKeys> {
    const auth = await randomBytes(16);
    const ecKeys = await generateEcKeys();
    await storage.write(STORAGE_KEYS.auth, fromBufferToUrlB64(auth));
    await writeEcKeys(storage, ecKeys, STORAGE_KEYS.privateEcKey);

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

  getKey<const T extends "auth" | "p256dh">(name: T): TKey<T> {
    if (name === "auth") {
      return fromBufferToUrlB64<TKey<T>>(this.keys.auth);
    } else {
      return fromBufferToUrlB64<TKey<T>>(this.keys.ecKeys.uncompressedPublicKey);
    }
  }

  unsubscribe(): Promise<void> {
    return this.unsubscribeCallback();
  }
}

export type PushSubscriptionOptions = {
  userVisibleOnly: boolean;
  applicationServerKey: string;
};
