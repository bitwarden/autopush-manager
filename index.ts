import { PushManager } from "./src/push-manager";

export { PublicPushManager as AutoPushManager } from "./src/push-manager";
export { PublicPushSubscription as AutoPushSubscription } from "./src/push-subscription";
export type { Logger } from "./src/logger";
export type { PublicStorage as StorageInterface } from "./src/storage";

export const createPushManager = PushManager.create;
