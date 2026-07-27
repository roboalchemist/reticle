import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

interface Manifest {
  publisher: string;
  license: string;
  icon: string;
  galleryBanner: { color: string; theme: string };
  repository: { type: string; url: string };
  categories: string[];
  keywords: string[];
  activationEvents: string[];
  contributes: {
    commands: Array<{ command: string; title: string }>;
    keybindings: Array<{ command: string; key: string; mac?: string; when?: string }>;
    configuration: {
      properties: Record<string, { default?: unknown; scope?: string }>;
    };
  };
}

const manifest = JSON.parse(readFileSync(`${process.cwd()}/package.json`, "utf8")) as Manifest;

describe("extension manifest", () => {
  it("contains the required public listing metadata", () => {
    expect(manifest).toMatchObject({
      publisher: "roboalchemist",
      license: "MIT",
      icon: "media/icon.png",
      galleryBanner: { color: "#071B3D", theme: "dark" },
      repository: {
        type: "git",
        url: "https://github.com/roboalchemist/reticle-mlx.git",
      },
    });
    expect(manifest.categories).toEqual(
      expect.arrayContaining(["Programming Languages", "Machine Learning"]),
    );
    expect(manifest.keywords).toEqual(expect.arrayContaining(["autocomplete", "fim", "byok"]));
  });

  it("contributes and activates the endpoint probe command", () => {
    expect(manifest.activationEvents).toContain("onCommand:reticle.testEndpoint");
    expect(manifest.contributes.commands).toContainEqual(
      expect.objectContaining({
        command: "reticle.testEndpoint",
        title: "Test Autocomplete Endpoint",
      }),
    );
  });

  it("uses a working macOS shortcut for forced inline completion", () => {
    expect(manifest.contributes.keybindings).toContainEqual({
      command: "reticle.triggerCompletion",
      key: "ctrl+alt+space",
      mac: "alt+\\",
      when: "editorTextFocus && !editorHasSelection",
    });
  });

  it("keeps the complete typed Reticle settings surface", () => {
    expect(Object.keys(manifest.contributes.configuration.properties).sort()).toEqual(
      [
        "apiKey",
        "baseURL",
        "debounceMs",
        "enableAutoTrigger",
        "extraHeaders",
        "fimFormat",
        "languageAllowlist",
        "languageDenylist",
        "maxLines",
        "maxTokens",
        "model",
        "multiFileContext",
        "temperature",
      ]
        .map((key) => `reticle.${key}`)
        .sort(),
    );
    expect(
      manifest.contributes.configuration.properties["reticle.enableAutoTrigger"],
    ).toMatchObject({
      default: true,
      scope: "resource",
    });
  });
});
