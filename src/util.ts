export const isNode =
  typeof process !== "undefined" &&
  process.versions != null &&
  process.versions.node != null &&
  // Overrides the `isNode` detection in `util.ts` to force the Node.js API path
  // This is for testing purposes and will resolve to true unless explicitly set to truthy
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above comment
  !(global as any)?.OverrideIsNode;
export const isBrowser = typeof window !== "undefined";
export const _global = isNode ? global : isBrowser ? window : self;
