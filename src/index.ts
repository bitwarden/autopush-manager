import { Logger } from "./logger";
import { PushManager } from "./push-manager";
import { PublicStorage } from "./storage";

export { PublicPushManager as AutoPushManager } from "./push-manager";
export { PublicPushSubscription as AutoPushSubscription } from "./push-subscription";

export const createPushManager = async (storage: PublicStorage, logger: Logger) => {
  return await PushManager.create(storage, logger);
};
