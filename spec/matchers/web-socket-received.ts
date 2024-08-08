import type { JsonObject, JsonValue } from "type-fest";

import { TestWebSocketClient } from "../test-websocket-server";

/**
 * Asserts that a given message was sent by a WebSocket client and received by the test server
 */
export const toHaveReceived: jest.CustomMatcher = function (
  received: TestWebSocketClient,
  expected: JsonObject | JsonValue,
) {
  if (received.messages.some((message) => this.equals(message, expected))) {
    return {
      message: () => `expected
${this.utils.printReceived(received.messages)}
not to have received
${this.utils.printExpected(expected)}`,
      pass: true,
    };
  }

  return {
    message: () => `expected
${this.utils.printReceived(received.messages)}
to have received
${this.utils.printExpected(expected)}`,
    pass: false,
  };
};

/**
 * Asserts that a given message was the last one sent by a WebSocket client and received by the test server
 */
export const toHaveLastReceived: jest.CustomMatcher = function (
  received: TestWebSocketClient,
  expected: JsonObject | JsonValue,
) {
  if (this.equals(received.messages[received.messages.length - 1], expected)) {
    return {
      message: () => `expected
${received}
not to have last received
${expected}`,
      pass: true,
    };
  }

  return {
    message: () => `expected
${received}
to have last received
${expected}`,
    pass: false,
  };
};

/**
 * Asserts that a given message was the Nth one sent by a WebSocket client and received by the test server
 */
export const toHaveNthReceived: jest.CustomMatcher = function (
  received: TestWebSocketClient,
  expected: JsonObject | JsonValue,
  n: number,
) {
  if (n < 0) {
    return {
      message: () => "expected positive value for n",
      pass: false,
    };
  }
  if (received.messages.length <= n) {
    return {
      message: () => `expected
${received}
to have received at least ${n + 1} messages`,
      pass: false,
    };
  }

  if (this.equals(received.messages[n], expected)) {
    return {
      message: () => `expected
${received}
not to have last received
${expected}`,
      pass: true,
    };
  }

  return {
    message: () => `expected
${received}
to have last received
${expected}`,
    pass: false,
  };
};
