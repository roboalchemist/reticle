import { describe, expect, it } from "vitest";

import type { ReticleSettings } from "../src/config/settings.js";
import { panelHtml } from "../src/ui/panelHtml.js";
import { mergePanelSettings, PANEL_SETTING_KEYS, panelSettingsFrom } from "../src/ui/panelModel.js";

const settings: ReticleSettings = {
  apiKey: "",
  baseURL: "http://127.0.0.1:8001/v1",
  debounceMs: 100,
  enableAutoTrigger: true,
  extraHeaders: {},
  fimFormat: "qwen",
  languageAllowlist: [],
  languageDenylist: [],
  maxLines: 8,
  maxTokens: 64,
  model: "default_model",
  multiFileContext: false,
  temperature: 0,
};

describe("Reticle control panel", () => {
  it("exposes the complete core settings form and preserves advanced settings", () => {
    expect(PANEL_SETTING_KEYS).toEqual([
      "baseURL",
      "model",
      "fimFormat",
      "maxTokens",
      "maxLines",
      "temperature",
      "debounceMs",
      "enableAutoTrigger",
      "multiFileContext",
    ]);
    expect(panelSettingsFrom(settings)).toMatchObject({
      baseURL: "http://127.0.0.1:8001/v1",
      fimFormat: "qwen",
      model: "default_model",
    });

    const merged = mergePanelSettings(settings, {
      ...panelSettingsFrom(settings),
      enableAutoTrigger: false,
      maxLines: 12,
      model: "next-model",
    });
    expect(merged).toMatchObject({
      apiKey: "",
      enableAutoTrigger: false,
      extraHeaders: {},
      languageAllowlist: [],
      maxLines: 12,
      model: "next-model",
    });
  });

  it("validates settings submitted by the webview", () => {
    expect(() =>
      mergePanelSettings(settings, {
        ...panelSettingsFrom(settings),
        debounceMs: 500,
      }),
    ).toThrow("reticle.debounceMs must be an integer from 75 to 150");
    expect(() =>
      mergePanelSettings(settings, {
        ...panelSettingsFrom(settings),
        maxTokens: Number.NaN,
      }),
    ).toThrow("reticle.maxTokens must be a number");
  });

  it("renders health, settings, completion-test, and log controls under a CSP", () => {
    const html = panelHtml("vscode-webview://panel", "nonce-value");

    expect(html).toContain("default-src 'none'");
    expect(html).toContain("script-src 'nonce-nonce-value'");
    for (const id of [
      "health-badge",
      "check-health",
      "test-completion",
      "settings-form",
      "open-settings",
      "copy-logs",
      "clear-logs",
      "open-output",
      "logs",
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
  });
});
