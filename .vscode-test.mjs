import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: ".e2e-out/**/*.test.js",
  version: "1.96.0",
  extensionDevelopmentPath: ".",
  workspaceFolder: "test/e2e/fixture/reticle.code-workspace",
  launchArgs: [
    "--disable-extensions",
    "--disable-workspace-trust",
    "--skip-welcome",
    "--skip-release-notes",
  ],
  mocha: {
    timeout: 30_000,
  },
});
