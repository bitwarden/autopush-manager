export const isNode =
  typeof process !== "undefined" &&
  process.versions != null &&
  process.versions.node != null &&
  !(global as any)?.OverrideIsNode;
export const isBrowser = typeof window !== "undefined";
export const _global = isNode ? global : isBrowser ? window : self;
