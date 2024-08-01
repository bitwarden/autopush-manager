const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("./tsconfig.spec.json");

/** @type {import('jest').Config} */
module.exports = {
  reporters: ["default", "jest-junit"],

  collectCoverage: true,
  // Ensure we collect coverage from files without tests
  collectCoverageFrom: ["src/**/*.ts"],
  coverageReporters: ["html", "lcov"],
  coverageDirectory: "coverage",

  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths || {}, {
    prefix: "<rootDir>/",
  }),

  // Workaround for a memory leak that crashes tests in CI:
  // https://github.com/facebook/jest/issues/9430#issuecomment-1149882002
  // Also anecdotally improves performance when run locally
  maxWorkers: 3,

  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        // Jest does not use tsconfig.spec.json by default
        tsconfig: "<rootDir>/tsconfig.spec.json",
        // Further workaround for memory leak, recommended here:
        // https://github.com/kulshekhar/ts-jest/issues/1967#issuecomment-697494014
        // Makes tests run faster and reduces size/rate of leak, but loses typechecking on test code
        // See https://bitwarden.atlassian.net/browse/EC-497 for more info
        isolatedModules: true,
      },
    ],
  },
  testMatch: ["**/+(*.)+(spec).+(ts)"],

  preset: "ts-jest",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths || {}, {
    prefix: "<rootDir>/",
  }),
};
