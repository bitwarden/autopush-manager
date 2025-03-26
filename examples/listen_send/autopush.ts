import { OptionValues, program } from "commander";

import { ListenCommand } from "./src/listen.command";
import { SendCommand } from "./src/send.command";
import { Storage } from "./src/storage";

const logger = console;
const storage = new Storage();

program
  .name("autopush")
  .description("An example usage of autopush-manager that has a listen mode and a send mode.")
  .version("0.1.0");

program
  .command("listen")
  .description("Connect to autopush and listen for messages")
  .option(
    "--serverPublicKey <serverKey>",
    "The Server's VAPID public key",
    "BCh0IFsAIOnY4b_wzbIJjFianmWZ8o0CIYWGiuRHIlEbFJ2doSdk5UlB1iRH4oW7FYi8sv51ZxASxBtpYVBBaUE",
  )
  .action(async ({ serverPublicKey }: OptionValues) => {
    const cmd = new ListenCommand(logger, storage);

    await cmd.listen(serverPublicKey);
  });
program
  .command("send")
  .description("Send messages to a listening autopush client. Note: messages longer than 1007 bytes will fail.")
  .option(
    "--serverPublicKey <serverPublicKey>",
    "The Server's VAPID public key",
    "BCh0IFsAIOnY4b_wzbIJjFianmWZ8o0CIYWGiuRHIlEbFJ2doSdk5UlB1iRH4oW7FYi8sv51ZxASxBtpYVBBaUE",
  )
  .option(
    "--serverPrivateKey <serverPrivateKey>",
    "The Server's VAPID private key",
    "Lf2uqdxcKNy1PiJ5q-o18uA59_61v7a8R9N9j2fWlr0",
  )
  .option(
    "--subscription <json>",
    "A JSON string representation of the subscription object to send to. By default this is read from a shared storage space with the listen command. This object must include the endpoint, auth key, and p256dh key",
  )
  .option(
    "--subject <mailto>",
    "Contact information for the creator of this content. Despite RFC8292, this must be a mailto: link",
    "mailto:mailto:webpush_ops@bitwarden.com",
  )
  .option(
    "--ttl <ttl>",
    "The time to live for the message in seconds",
    "60",
  )
  .argument("<message>", "The message to send")
  .action(
    async (
      message: string,
      { serverPublicKey, serverPrivateKey, subscription, subject, ttl }: OptionValues,
    ) => {
      const cmd = new SendCommand(logger, storage);
      const ttlNumber = parseInt(ttl, 10);

      if (!subscription) {
        subscription = await cmd.readSubscription();
      } else {
        subscription = JSON.parse(subscription);
      }

      await cmd.send(
        message,
        subscription,
        { public: serverPublicKey, private: serverPrivateKey },
        subject,
        ttlNumber
      );
    },
  );

program.parse();
