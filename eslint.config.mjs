import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      ".e2e-out/**",
      ".vscode-test/**",
      "node_modules/**",
      "test/e2e/fixture/**",
      "*.vsix",
      "*.mjs",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["src/**/*.ts", "test/*.ts", "test/integration/**/*.ts", "vitest.config.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["test/e2e/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.e2e.json",
        projectService: false,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
