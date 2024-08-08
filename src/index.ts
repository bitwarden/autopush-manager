import { PushManager } from "./push-manager";

export { PublicPushManager as AutoPushManager } from "./push-manager";
export { PublicPushSubscription as AutoPushSubscription } from "./push-subscription";

export const createPushManager = PushManager.create;
