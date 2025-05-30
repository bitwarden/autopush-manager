import { createPushManager, Logger } from "autopush-manager";

import { Storage } from "./storage";

export class ListenCommand {
  constructor(
    private readonly logger: Logger,
    private readonly storage: Storage,
  ) {}

  async listen(applicationServerKey: string): Promise<void> {
    this.logger.info("Starting to listen...");

    const pushManager = await createPushManager(this.storage, this.logger);
    const subscription = await pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    this.logger.info("Subscription created", JSON.parse(JSON.stringify(subscription)));
    subscription.addEventListener("notification", (event) => {
      this.logger.info("Received notification", event);
    });
    subscription.addEventListener("pushsubscriptionchange", (event) => {
      this.logger.info("Subscription changed. I should tell the server!!", event);
    });
  }
}
