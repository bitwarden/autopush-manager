import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import eslintConfigPrettier from "eslint-config-prettier";

import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";

export default defineConfig([
    globalIgnores([
        "**/build/",
        "**/coverage/",
        "**/node_modules/",
        "**/jest.*.config.js",
        "**/jest.config.js",
        "examples/",
    ]),
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.jest,
            },
        },
    },
    {
        files: ["**/*.mjs"],
        extends: [eslint.configs.recommended],

        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2020,
            sourceType: "module",
        },
    },
    {
        files: ["**/.cjs"],
        extends: [eslint.configs.recommended],

        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2020,
            sourceType: "script",
        },
    },
    tseslint.config({
        files: ["**/*.ts", "**/*.js"],
        ignores: ["**/test*.setup.ts", "**/test.environment.ts"],
        extends: [
            eslint.configs.recommended,
            ...tseslint.configs.recommended,
            importPlugin.flatConfigs.recommended,
            importPlugin.flatConfigs.typescript,
            eslintConfigPrettier,
        ],
        settings: {
            "import/parsers": {
                "@typescript-eslint/parser": [".ts"],
            },
            "import/resolver": {
                typescript: {
                    alwaysTryTypes: true,
                },
            },
        },

        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2020,
            sourceType: "module",

            parserOptions: {
                project: ["./tsconfig.eslint.json"],
            },
        },
        rules: {
            "@typescript-eslint/explicit-member-accessibility": [
                "error",
                {
                    accessibility: "no-public",
                },
            ],
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/no-misused-promises": [
                "error",
                {
                    checksVoidReturn: false,
                },
            ],
            "@typescript-eslint/no-this-alias": [
                "error",
                {
                    allowedNames: ["self"],
                },
            ],
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    args: "none",
                },
            ],
            "no-console": "error",
            "import/no-unresolved": "error",
            "import/order": [
                "error",
                {
                    alphabetize: {
                        order: "asc",
                    },
                    "newlines-between": "always",
                    pathGroups: [
                        {
                            pattern: "@bitwarden/**",
                            group: "external",
                            position: "after",
                        },
                        {
                            pattern: "src/**/*",
                            group: "parent",
                            position: "before",
                        },
                    ],
                    pathGroupsExcludedImportTypes: ["builtin"],
                },
            ],
            "no-restricted-syntax": [
                "error",
                {
                    message: "Calling `svgIcon` directly is not allowed",
                    selector: "CallExpression[callee.name='svgIcon']",
                },
                {
                    message: "Accessing FormGroup using `get` is not allowed, use `.value` instead",
                    selector:
                        "ChainExpression[expression.object.callee.property.name='get'][expression.property.name='value']",
                },
            ],
            curly: ["error", "all"],
            "import/namespace": ["off"],
        },
    }),
]);
