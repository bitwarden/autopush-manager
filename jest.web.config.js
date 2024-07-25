const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("./tsconfig.json");

const sharedConfig = require("./jest.shared.config");

/** @type {import('jest').Config} */
module.exports = {
  ...sharedConfig,
  testMatch: ["**/+(*.)+(web-spec|spec).+(ts)"],

  displayName: "web-specific tests",
  preset: "ts-jest",
  testEnvironment: "./test.environment.ts",
  setupFilesAfterEnv: ["<rootDir>/test.web.setup.ts"],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths || {}, {
    prefix: "<rootDir>/",
  }),
};
