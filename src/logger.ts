import type { JoinStrings } from "./string-manipulation";

export interface Logger extends Pick<Console, "debug" | "info" | "warn" | "error"> {}

export class NamespacedLogger<const TNamespace extends string> implements Logger {
  constructor(private readonly logger: Logger, private readonly namespace: TNamespace) {}

  debug(message: string, ...args: unknown[]) {
    this.logger.debug(`[${this.namespace}] ${message}`, ...args);
  }

  info(message: string, ...args: unknown[]) {
    this.logger.info(`[${this.namespace}] ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    this.logger.warn(`[${this.namespace}] ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]) {
    this.logger.error(`[${this.namespace}] ${message}`, ...args);
  }

  extend<const TExtend extends string>(namespace: TExtend) {
    return new NamespacedLogger<JoinStrings<TNamespace, TExtend>>(
      this.logger,
      `${this.namespace}:${namespace}`
    );
  }
}
