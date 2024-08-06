# Autopush Manager

A module to subscribe to Mozilla Autopush and receive notifications.

# Example

A node example is provided in the `examples` directory. It can be run from the root project directory with:

```bash
npm run build && node examples/autopush.cjs
```

It will connect to the Mozilla Autopush server and listen for notifications. Log messages and subscriptions are printed to the console. Notifications can be sent to the subscription through normal means. https://web-push-codelab.glitch.me/ is a good resource for debugging. Simply update the `applicationServerKey` in the example to the one provided by the push companion.
