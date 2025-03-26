import { PushManager } from "./push-manager";

export { PublicPushManager as AutoPushManager } from "./push-manager";
export { PublicPushSubscription as AutoPushSubscription } from "./push-subscription";
export type { Logger } from "./logger";
export type { PublicStorage as Storage } from "./storage";

export const createPushManager = PushManager.create;
