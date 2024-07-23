const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("./tsconfig.module.json");

const sharedConfig = require("./jest.shared.config");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  testMatch: ["**/+(*.)+(node-spec).+(ts)"],

  displayName: "node-specific tests",
  preset: "ts-jest",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/test.setup.node.ts"],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths || {}, {
    prefix: "<rootDir>/",
  }),
};
