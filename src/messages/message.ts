import type { Guid } from "../string-manipulation";

export type AutoConnectServerMessage = {
  readonly messageType: "hello" | "register" | "unregister" | "broadcast" | "notification" | "ping";
};

type StatusMessage = {
  readonly status: number;
};

export type ServerHello = AutoConnectServerMessage &
  StatusMessage & {
    readonly messageType: "hello";
    readonly uaid: string;
    readonly useWebPush: boolean;
    // TODO: There should be a `broadcasts` hashMap here, but I'm not sure of its contents
  };

export type ServerRegister = AutoConnectServerMessage &
  StatusMessage & {
    readonly messageType: "register";
    readonly channelId: Guid;
    readonly pushEndpoint: string;
  };

export type ServerUnregister = AutoConnectServerMessage &
  StatusMessage & {
    readonly messageType: "unregister";
    readonly channelId: Guid;
  };

export type ServerBroadcast = AutoConnectServerMessage & {
  readonly messageType: "broadcast";
  // TODO: there should be a `broadcasts` hashMap here, but I'm not sure of its contents
};

export type ServerNotification = AutoConnectServerMessage & {
  readonly messageType: "notification";
  readonly channelId: Guid;
  readonly version: string;
  readonly ttl: number;
  readonly data: string | null;
  readonly headers: Record<string, string> | null;
};

export type ServerPing = AutoConnectServerMessage & {
  readonly messageType: "ping";
};

export type ClientMessageType =
  | "hello"
  | "register"
  | "unregister"
  | "broadcast_subscribe"
  | "ack"
  | "nack"
  | "ping";

export type AutoConnectClientMessage = {
  messageType: ClientMessageType;
};

export type ClientHello = AutoConnectClientMessage & {
  messageType: "hello";
  /** The existing Id of this user agent. Null indicates a new user agent */
  uaid: string | null;
  /** Channel Ids associated with this user agent. */
  channelIds: Guid[];
  // TODO document this
  broadcasts?: Record<string, string>;
};

export type ClientRegister = AutoConnectClientMessage & {
  messageType: "register";
  /** The channel Id to register */
  channelId: Guid;
  /** VAPID public key. This is currently required by this library, but optional in the spec*/
  key: string;
};

export const ClientUnregisterCodes = Object.freeze({
  USER_UNSUBSCRIBED: 200,
  // TODO: handle other codes
  // QUOTA_EXCEEDED: 201,
  // PERMISSION_LOSS: 202,
} as const);
export type ClientUnregisterCode =
  (typeof ClientUnregisterCodes)[keyof typeof ClientUnregisterCodes];
export type ClientUnregister = AutoConnectClientMessage & {
  messageType: "unregister";
  /** The channel id to unregister */
  channelId: Guid;
  /** Unregister reason
   * - 200: User manually unsubscribed
   * - 201: Unregistered after exceeding quota
   * - 202: Unregistered due to permission loss
   */
  code: ClientUnregisterCode;
};

export type ClientBroadcastSubscribe = AutoConnectClientMessage & {
  broadcasts: Record<string, string>;
};

export const ClientAckCodes = Object.freeze({
  SUCCESS: 100,
  DECRYPT_FAIL: 101,
  OTHER_FAIL: 102,
} as const);
export type ClientAckCode = (typeof ClientAckCodes)[keyof typeof ClientAckCodes];

export type ClientMessageAck = {
  channelId: Guid;
  version: string;
  /** Message Acknowledged result
   * - 100: Message successfully delivered to application
   * - 101: Message received, but failed to decrypt
   * - 102: Message not delivered to application for some other reason
   */
  code: ClientAckCode;
};

export type ClientAck = AutoConnectClientMessage & {
  messageType: "ack";
  updates: ClientMessageAck[];
};

export const ClientNackCodes = Object.freeze({
  RESERVED: 300,
  PUSH_HANDLER_EXCEPTION: 301,
  WAIT_UNTIL_REJECTED: 302,
  OTHER_FAIL: 303,
} as const);
export type ClientNackCode = (typeof ClientNackCodes)[keyof typeof ClientNackCodes];

export type ClientNack = AutoConnectClientMessage & {
  messageType: "nack";
  channelId: Guid;
  version: string;
  /** Message Not Acknowledged result
   * - 300 RESERVED
   * - 301 `push` handler threw an uncaught exception
   * - 302 The promise passed to `pushEvent.waitUntil()` rejected with an error.
   * - 303 Other error occurred while dispatching the event
   */
  code: ClientNackCode;
};

export type ClientPing = AutoConnectClientMessage & {
  messageType: "ping";
};
