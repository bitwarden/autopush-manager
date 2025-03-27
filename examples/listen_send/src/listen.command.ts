import { createPushManager, Logger } from 'autopush-manager/src/index'

import { Storage } from "./storage";

export class ListenCommand {
  constructor(
    private readonly logger: Logger,
    private readonly storage: Storage,
  ){}

  async listen(applicationServerKey: string): Promise<void> {
    this.logger.info('Starting to listen...')

    const pushManager = await createPushManager(this.storage, this.logger, {
      // Use the staging environment for demos.
      // Dev environments always return 404 when sending notifications
      // Can use your own autopush infrastructure
      autopushUrl: "wss://autoconnect.stage.mozaws.net/",
    });
    const subscription = await pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });

    this.logger.info("Subscription created", JSON.parse(JSON.stringify(subscription)));
    subscription.addEventListener("notification", (event) => {
      this.logger.info("Received notification", event);
    });
    subscription.addEventListener("pushsubscriptionchange", (event) => {
      this.logger.info("Subscription changed. I should tell the server!!", event);
    })
  }
}
