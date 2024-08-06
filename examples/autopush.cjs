// VAPID keys for example:
// Public Key: BCh0IFsAIOnY4b_wzbIJjFianmWZ8o0CIYWGiuRHIlEbFJ2doSdk5UlB1iRH4oW7FYi8sv51ZxASxBtpYVBBaUE
// Private Key: Lf2uqdxcKNy1PiJ5q-o18uA59_61v7a8R9N9j2fWlr0

const fs = require("fs");

class Storage {
    #store;
    constructor() {
        if (!fs.existsSync("storage.json")) {
            fs.writeFileSync("storage.json", JSON.stringify([]), "utf8");
        }
        const storedMap = JSON.parse(fs.readFileSync("storage.json", "utf8"));
        this.#store = new Map(storedMap);
    }
    async read(key) {
        return this.#store.get(key);
    }

    async write(key, value) {
        this.#store.set(key, value);
        const toStore = JSON.stringify([...this.#store.entries()], null, 2);
        fs.writeFileSync("storage.json", toStore, "utf8");
    }

    async remove(key) {
        this.#store.delete(key);
        const toStore = JSON.stringify([...this.#store.entries()]);
        fs.writeFileSync("storage.json", toStore, "utf8");
    }
}

const logger = console;
const storage = new Storage();

require("../build/src/index")
    .createPushManager(storage, logger)
    .then(async (pushManager) => {
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
