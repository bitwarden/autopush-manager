import { WebSocketServer, WebSocket } from "ws";

import {
  AutoConnectClientMessage,
  ClientHello,
  ClientRegister,
  ServerHello,
  ServerPing,
  ServerRegister,
  ServerUnregister,
} from "../src/messages/message";
import { fromBufferToUtf8, newUuid, Uuid } from "../src/string-manipulation";

export const defaultUaid = "5f0774ac-09a3-45d9-91e4-f4aaebaeec72";
const defaultHelloHandler = (
  client: TestWebSocketClient,
  message: ClientHello,
  server: TestWebSocketServer,
) => {
  // Identify the client
  const identifiedClient = new IdentifiedWebSocketClient(client, defaultUaid);
  server.identifiedClients.push(identifiedClient);

  // Make sure we track channels for this client
  for (const channelID of message.channelIDs ?? []) {
    server.channelToClientMap.set(channelID, identifiedClient);
  }

  // Send a response
  const response: ServerHello = {
    messageType: "hello",
    uaid: defaultUaid,
    useWebPush: true,
    status: 200,
    // broadcasts: {},
  };
  client.ws.send(JSON.stringify(response));
};

const defaultRegisterHandler = (
  client: IdentifiedWebSocketClient,
  message: ClientRegister,
  server: TestWebSocketServer,
) => {
  server.channelToClientMap.set(message.channelID, client);

  // Send a response
  const response: ServerRegister = {
    messageType: "register",
    channelID: message.channelID,
    pushEndpoint: `https://example.com/push//${message.channelID}`,
    status: 200,
  };
  client.ws.send(JSON.stringify(response));
};

const defaultUnregisterHandler = (
  client: IdentifiedWebSocketClient,
  message: ClientRegister,
  server: TestWebSocketServer,
) => {
  server.channelToClientMap.delete(message.channelID);

  // Send a response
  const response: ServerUnregister = {
    messageType: "unregister",
    channelID: message.channelID,
    status: 200,
  };
  client.ws.send(JSON.stringify(response));
};

const defaultServerPingHandler = (client: IdentifiedWebSocketClient) => {
  const response: ServerPing = {
    messageType: "ping",
  };
  client.ws.send(JSON.stringify(response));
};

export class TestWebSocketServer {
  readonly server: WebSocketServer;
  readonly channelToClientMap: Map<Uuid, IdentifiedWebSocketClient>;
  readonly clients: TestWebSocketClient[] = [];
  readonly identifiedClients: IdentifiedWebSocketClient[] = [];

  helloHandler = defaultHelloHandler;
  registerHandler = defaultRegisterHandler;
  unregisterHandler = defaultUnregisterHandler;
  serverPingHandler = defaultServerPingHandler;

  constructor(port: number) {
    this.server = new WebSocketServer({ port });
    this.channelToClientMap = new Map();

    this.server.on("connection", (ws) => {
      let client = new TestWebSocketClient(ws);
      this.clients.push(client);

      ws.on("message", (data, isBinary) => {
        if (isBinary) {
          ws.close(1002, "Bad request");
          return;
        }

        client = this.identifiedClientFor(ws) ?? client;

        this.messageHandler(client, JSON.parse(fromBufferToUtf8(data as ArrayBuffer)));
      });
      ws.on("close", () => {
        //remove client from identifiedClients
        const identifiedClient = this.identifiedClientFor(ws);
        if (identifiedClient) {
          this.identifiedClients.splice(this.identifiedClients.indexOf(identifiedClient), 1);
        }

        //remove client from clients
        const clientIndex = this.clients.indexOf(client);
        if (clientIndex !== -1) {
          this.clients.splice(clientIndex, 1);
        }
      });
    });
  }

  closeClients() {
    for (const client of this.clients) {
      client.ws.close(1001, "Server closing");
    }
    // Clear the identifiedClients array
    this.identifiedClients.splice(0, this.identifiedClients.length);
    // Clear the clients array
    this.clients.splice(0, this.clients.length);
  }

  async close() {
    return new Promise<void>((resolve, reject) => {
      this.closeClients();
      this.server.close((e) => {
        if (e) {
          reject(e);
        } else {
          resolve();
        }
      });
    });
  }

  get port() {
    return this.server.options.port;
  }

  clientFor(ws: WebSocket) {
    return this.clients.find((client) => client.ws === ws);
  }

  identifiedClientFor(id: Uuid | WebSocket) {
    if (id instanceof WebSocket) {
      return this.identifiedClients.find((client) => client.ws === id);
    }
    return this.channelToClientMap.get(id);
  }

  /**
   * Sends a notification to a client channel
   * @param channelID channel ID to notify
   * @param data The data to send
   * @returns The version of the notification. This version should be ACK'd by the client
   */
  sendNotification(channelID: Uuid, data?: string, headers?: Record<string, string>): string {
    const client = this.channelToClientMap.get(channelID);
    if (!client) {
      throw new Error("Client not found");
    }

    const version = newUuid();
    const message = {
      messageType: "notification",
      channelID,
      version,
      ttl: 60,
      data,
      headers,
    };
    client.ws.send(JSON.stringify(message));
    return version;
  }

  private messageHandler(
    client: TestWebSocketClient | IdentifiedWebSocketClient,
    message: AutoConnectClientMessage,
  ) {
    if (!message?.messageType) {
      client.ws.close(1002, "Bad request");
      return;
    }

    if (client instanceof IdentifiedWebSocketClient) {
      this.identifiedMessageHandler(client, message);
      return;
    } else {
      this.unidentifiedMessageHandler(client, message);
    }
  }

  private unidentifiedMessageHandler(
    client: TestWebSocketClient,
    message: AutoConnectClientMessage,
  ) {
    if (message.messageType === "hello") {
      this.helloHandler(client, message as ClientHello, this);
    } else {
      client.ws.close(1002, "Bad request");
    }
  }

  private identifiedMessageHandler(
    client: IdentifiedWebSocketClient,
    message: AutoConnectClientMessage,
  ) {
    switch (message.messageType) {
      case "register":
        this.registerHandler(client, message as ClientRegister, this);
        break;
      case "unregister":
        this.unregisterHandler(client, message as ClientRegister, this);
        break;
      case "ping":
        this.serverPingHandler(client);
        break;
      default:
        client.ws.close(1002, "Bad request");
    }
  }
}

export class TestWebSocketClient {
  readonly messages: unknown[] = [];
  constructor(readonly ws: WebSocket) {
    ws.on("message", (message) => {
      const utf8 = fromBufferToUtf8(message as ArrayBuffer);
      const json = JSON.parse(utf8);
      this.messages.push(json);
    });
  }

  send(...args: Parameters<WebSocket["send"]>) {
    this.ws.send(...args);
  }
}

export class IdentifiedWebSocketClient implements TestWebSocketClient {
  constructor(
    readonly upgradedClient: TestWebSocketClient,
    readonly uaid: string,
  ) {}

  get messages() {
    return this.upgradedClient.messages;
  }

  get ws() {
    return this.upgradedClient.ws;
  }

  send(...args: Parameters<WebSocket["send"]>) {
    this.upgradedClient.send(...args);
  }
}
