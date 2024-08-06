const storage = new Map();
const logger = console;

require("../build/src/index")
  .createPushManager(
    {
      write: async (key, value) => {
        storage.set(key, value);
        return Promise.resolve();
      },
      read: async (key) => {
        return Promise.resolve(storage.get(key));
      },
      remove: async (key) => {
        storage.delete(key);
        return Promise.resolve();
      },
    },
    logger,
  )
  .then(async (pushManager) => {
    // wait 5 seconds
    await new Promise((resolve) => {
      setTimeout(resolve, 5000);
    });
    const subscription = await pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey:
        "BCh0IFsAIOnY4b_wzbIJjFianmWZ8o0CIYWGiuRHIlEbFJ2doSdk5UlB1iRH4oW7FYi8sv51ZxASxBtpYVBBaUE",
    });

    logger.log("Subscription created", JSON.stringify(subscription));

    subscription.addEventListener("notification", (event) => {
      logger.log("Received notification", event);
    });
  });
