const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("./tsconfig");

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
  projects: ["jest.web.config.js", "jest.node.config.js"],

  // Workaround for a memory leak that crashes tests in CI:
  // https://github.com/facebook/jest/issues/9430#issuecomment-1149882002
  // Also anecdotally improves performance when run locally
  maxWorkers: 3,
};
