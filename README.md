# Autopush-Manager

A module to subscribe to Mozilla Autopush and receive notifications.

This library follows the Mozilla Web Push Proprietary Protocol, helpfully documented in the [Mozilla Push Documentation](https://mozilla-push-service.readthedocs.io/en/latest/design/#webpush-proprietary-protocol).

## Build

To build the project, run:

```bash
npm ci
npm run build
```

## Usage

Autopush-Manager will run in Node and browser contexts. The goal is to bring web-push capabilities to contexts that
currently lack support, such as Electron applications and certain browser contexts
(e.g. Firefox extension background pages)

> **NOTE:** Autopush-Manager works in browsers in order to bring push notifications to contexts that do not yet support
> them natively. _Always_ use the natively provided `PushManager` if it is available.

Example usages are provided in the [examples](./examples) directory.

Autopush-Manager provides a similar interface to the native `PushManager` API.
However, you must first create a `PushManager`, since none is provided by the platform.

```javascript
const pubhManager = await createPushManager(storage, logger);
```

The `storage` parameter is an object that implements the `Storage` interface and is used to restore connections between
application restarts. The `logger` parameter is an object that implements the `Logger` interface, which is a subset of
`console`. Autopush-Manager can be quite chatty, so you may want to filter debugging messages in your logger.

`createPushManager` also accepts an optional `options` parameter, which can be used to configure the `PushManager` to
target a different autopush instance, ack message interval, and delay websocket reconnect attempts:

```javascript
const pubhManager = await createPushManager(storage, logger, {
    autopushUrl: "wss://my.autopush.instance/",
    ackIntervalMs: 10_000, // defaults to 30 seconds
    reconnectDelay: backoffMethod, // defaults to a constant 1 second
});
```

Once a `PushManager` is created, you can use it to subscribe to notifications:

```javascript
const subscription = await pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: "base64url-encoded-VAPID-public-key",
});
```

A single `PushManager` can manage multiple subscriptions, but only one per `applicationServerKey`.

Subscriptions have a simplified event interface compared to the native `PushSubscription` interface. It emits only two events

-   notification
-   pushsubscriptionchange

```javascript
subscription.addEventListener("notification", (message) => {
    console.log("Notification received:", message);
});
subscription.addEventListener("pushsubscriptionchange", (subscriptionJson) => {
    console.log("Push subscription changed:", subscriptionJson);
});
```
