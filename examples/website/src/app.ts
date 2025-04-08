import { Logger, StorageInterface } from "autopush-manager";

import { Listener } from "./listen";

// eslint-disable-next-line no-console
console.log("hello, world!");

const logger: Logger = console; // Replace with your preferred logger

function fromJSON<T>(json: string | null): T | null {
  if (json === null) {
    return null;
  }
  try {
    return JSON.parse(json);
  } catch (e) {
    logger.error("Failed to parse JSON", e);
    return null;
  }
}

function toJSON<T>(value: T | null): string | null {
  if (value === null) {
    return null;
  }
  try {
    return JSON.stringify(value);
  } catch (e) {
    logger.error("Failed to stringify JSON", e);
    return null; // Return null if serialization fails
  }
}

const storage: StorageInterface = {
  read: (key: string) => Promise.resolve(fromJSON(window.localStorage.getItem(key))),
  write: <T>(key: string, value: T) =>
    Promise.resolve(window.localStorage.setItem(key, toJSON(value) as string)),
  remove: (key: string) => Promise.resolve(window.localStorage.removeItem(key)),
};

const listener = new Listener(storage, logger);
void listener.listen(
  "BCh0IFsAIOnY4b_wzbIJjFianmWZ8o0CIYWGiuRHIlEbFJ2doSdk5UlB1iRH4oW7FYi8sv51ZxASxBtpYVBBaUE",
);
