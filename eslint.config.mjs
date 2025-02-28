import globals from "globals";
import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import _import from "eslint-plugin-import";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default [
    {
        ignores: [
            "**/build",
            "**/coverage",
            "**/node_modules",
            "**/jest.*.config.js",
            "**/jest.config.js",
        ],
    },
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.webextensions,
            },
        },
    },
    ...fixupConfigRules(
        compat.extends(
            "eslint:recommended",
            "plugin:@typescript-eslint/strict",
            "plugin:import/recommended",
            "plugin:import/typescript",
            "prettier",
        ),
    ).map((config) => ({
        ...config,
        files: ["**/*.ts", "**/*.js"],
        ignores: ["**/test*.setup.ts", "**/test.environment.ts"],
    })),
    {
        files: ["**/*.ts", "**/*.js"],
        ignores: ["**/test*.setup.ts", "**/test.environment.ts"],

        plugins: {
            "@typescript-eslint": fixupPluginRules(typescriptEslint),
            import: fixupPluginRules(_import),
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
    },
];
