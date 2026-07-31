import { describe, expect, it } from "vitest";

import {
  SettingsError,
  isLoopbackURL,
  isLanguageEnabled,
  readSettings,
  validateSettings,
} from "../src/config/settings.js";

function configuration(values: Record<string, unknown>) {
  return {
    get<T>(section: string, defaultValue: T): T {
      return (values[section] ?? defaultValue) as T;
    },
  };
}

describe("Reticle settings", () => {
  it("resolves typed defaults and normalizes list/header values", () => {
    const settings = readSettings(
      configuration({
        model: " qwen-fim ",
        languageAllowlist: ["typescript", "", "typescript"],
        extraHeaders: { "x-provider": "yes" },
        debounceMs: 5,
      }),
    );
    expect(settings.model).toBe("qwen-fim");
    expect(settings.languageAllowlist).toEqual(["typescript"]);
    expect(settings.extraHeaders).toEqual({ "x-provider": "yes" });
    expect(settings.fimFormat).toBe("openai");
    expect(settings.debounceMs).toBe(75);
    expect(settings.maxLines).toBe(8);
    expect(settings.maxTokens).toBe(256);
  });

  it("applies denylist precedence and restricts a non-empty allowlist", () => {
    expect(isLanguageEnabled({ languageAllowlist: [], languageDenylist: [] }, "markdown")).toBe(
      true,
    );
    expect(
      isLanguageEnabled(
        { languageAllowlist: ["typescript", "markdown"], languageDenylist: ["markdown"] },
        "markdown",
      ),
    ).toBe(false);
    expect(
      isLanguageEnabled({ languageAllowlist: ["typescript"], languageDenylist: [] }, "python"),
    ).toBe(false);
    expect(
      isLanguageEnabled({ languageAllowlist: ["typescript"], languageDenylist: [] }, "TypeScript"),
    ).toBe(true);
  });

  it("allows keyless loopback URLs but requires a key remotely", () => {
    const local = readSettings(configuration({ model: "fim" }));
    expect(validateSettings(local)).toBe(local);
    expect(isLoopbackURL("http://[::1]:8001/v1")).toBe(true);
    expect(isLoopbackURL("http://127.42.0.9:8001/v1")).toBe(true);
    expect(isLoopbackURL("http://localhost.example.com/v1")).toBe(false);

    const remote = { ...local, baseURL: "https://inference.example/v1" };
    expect(() => validateSettings(remote)).toThrow(SettingsError);
    expect(() => validateSettings(remote)).toThrow("Remote endpoints require reticle.apiKey");
    expect(validateSettings({ ...remote, apiKey: "secret" }).apiKey).toBe("secret");
    expect(() =>
      validateSettings({ ...remote, baseURL: "http://inference.example/v1", apiKey: "secret" }),
    ).toThrow("Remote endpoints must use https");
  });

  it("reports actionable invalid model, URL, numeric, and header settings", () => {
    const valid = readSettings(configuration({ model: "fim" }));
    expect(() => validateSettings({ ...valid, model: "" })).toThrow("No model is configured");
    expect(() => validateSettings({ ...valid, baseURL: "file:///tmp/model" })).toThrow(
      "must use http or https",
    );
    expect(() =>
      validateSettings({ ...valid, baseURL: "http://user:pass@localhost:8001/v1" }),
    ).toThrow("must not contain credentials");
    expect(() => validateSettings({ ...valid, maxTokens: 0 })).toThrow("must be an integer");
    expect(() => validateSettings({ ...valid, maxLines: 0 })).toThrow(
      "reticle.maxLines must be an integer",
    );
    expect(() => validateSettings({ ...valid, extraHeaders: { "x-bad\nname": "value" } })).toThrow(
      "invalid characters",
    );
    expect(() => readSettings(configuration({ model: 42 }))).toThrow(
      "reticle.model must be a string",
    );
    expect(() => readSettings(configuration({ model: "fim", extraHeaders: { bad: 42 } }))).toThrow(
      "every reticle.extraHeaders value must be a string",
    );
    expect(() => readSettings(configuration({ model: "fim", fimFormat: "unknown" }))).toThrow(
      'reticle.fimFormat must be "codestral", "openai", "qwen", "seed", or "zeta"',
    );
  });

  it("accepts the Zeta editable-region FIM transport", () => {
    expect(readSettings(configuration({ model: "zeta", fimFormat: "zeta" })).fimFormat).toBe(
      "zeta",
    );
  });
});
