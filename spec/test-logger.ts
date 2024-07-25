/* eslint-disable no-console */
import { mock } from "jest-mock-extended";

import { Logger, NamespacedLogger } from "../src/logger";

export class TestLogger implements Logger {
  readonly mock = mock<Logger>();
  readonly outputToConsole = false;
  debug(message?: unknown, ...optionalParams: unknown[]): void {
    this.mock.debug(message, ...optionalParams);
    if (this.outputToConsole) {
      console.debug(message, ...optionalParams);
    }
  }
  info(message?: unknown, ...optionalParams: unknown[]): void {
    this.mock.info(message, ...optionalParams);
    if (this.outputToConsole) {
      console.info(message, ...optionalParams);
    }
  }
  warn(message?: unknown, ...optionalParams: unknown[]): void {
    this.mock.warn(message, ...optionalParams);
    if (this.outputToConsole) {
      console.warn(message, ...optionalParams);
    }
  }
  error(message?: unknown, ...optionalParams: unknown[]): void {
    this.mock.error(message, ...optionalParams);
    if (this.outputToConsole) {
      console.error(message, ...optionalParams);
    }
  }

  setNamespace<const TString extends string>(namespace: TString): NamespacedLogger<TString> {
    return new NamespacedLogger(this, namespace) as NamespacedLogger<TString>;
  }
}
