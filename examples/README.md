# Examples

This directory contains examples of how to use the Autopush-Manager module.

These examples all reference a local build of `autopush-manager`, so you have to build it, first.

## Simple Listener

A node script which establishes a connection to the Mozilla Autopush servers and listen for notifications.
Log messages, subscription details, and notifications are printed to the console.

### Run

From the `simple_listener` directory, run:

```bash
node listen.cjs
```

Notifications can be sent to the subscription through normal means. https://web-push-codelab.glitch.me/ is a good resource for debugging. Simply update the `applicationServerKey` in the example to the one provided by the push companion.

## Listen Send

A node command line application that can both connect to autopush to listen for notifications and send notifications to a given subscription.

Use the `--help` flag to see the available options and to inspect options on subcommands.

```bash
node listen_send.js --help
node listen_send.js listen --help
node listen_send.js send --help
```

### Build

From the `listen_send` directory, run:

```bash
npm ci
npm run build
```

### Listening for Notifications

From the `listen_send/build` directory, run:

```bash
node listen_send.cjs listen
```

to start listening for notifications. This will create or update a new `storage.json` file in the current directory.
This file contains the negotiated subscription details. It can be used to reinitialize this same connection on subsequent
executions, or transformed slightly to send to a server to allow that server to deliver notifications to it.
If you want to create a totally new subscription, delete the `storage.json` file and run the command again.

### Sending Notifications

In a typical use case, you would have a server that is responsible for sending notifications to the subscription.
However, for testing and illustration purposes, this example allows you to send notifications from the command line to
a previously stored subscription.

To send a notification, run:

```bash
node listen_send.cjs send "The content of the message"
```

By default, this command will read `storage.json` to determine an endpoint and correctly encrypt the message. You can specify
a different subscription with the `--subscription` flag. The subscription must be a valid JSON string. For example:

```json
{
    "endpoint": "https://example.com/endpoint",
    "keys": {
        "p256dh": "base64url-encoded-raw-public-key",
        "auth": "base64url-encoded-auth-secret"
    }
}
```

Other options exist to make this command useful to send notifications to arbitrary subscriptions, assuming you have the
necessary keys. Use the `--help` flag to see the available options.

## Website

A website showcasing the usage of Autopush-Manager in browser contexts. There is no real difference here from the
[Simple Listener](#simple-listener) example, but for execution in a browser.

Open dev tools to see Autopush-Manager log output and use `listen_send` to send notifications to the browser page.

**NOTE:** Autopush-Manager works in browsers in order to bring push notifications to contexts that do not yet support
them natively. **ALWAYS** use the natively provided `PushManager` if it is available.
