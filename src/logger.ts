import { joinNamespaces, type JoinStrings } from "./string-manipulation";

export type Logger = Pick<Console, "debug" | "info" | "warn" | "error">;

export class TimedLogger implements Logger {
  constructor(private readonly logger: Logger) {}

  get time() {
    return new Date().toISOString();
  }

  debug(message: string, ...args: unknown[]) {
    this.logger.debug(`[${this.time}] ${message}`, ...args);
  }

  info(message: string, ...args: unknown[]) {
    this.logger.info(`[${this.time}] ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    this.logger.warn(`[${this.time}] ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]) {
    this.logger.error(`[${this.time}] ${message}`, ...args);
  }

  extend<const TExtend extends string>(namespace: TExtend) {
    return new NamespacedLogger<TExtend>(this.logger, namespace);
  }
}

export class NamespacedLogger<const TNamespace extends string> implements Logger {
  constructor(
    private readonly logger: Logger,
    private readonly namespace: TNamespace,
  ) {}

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
      joinNamespaces(this.namespace, namespace),
    );
  }
}
