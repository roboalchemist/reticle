import { clampDebounceMs } from "../completion/debounce.js";

export interface ConfigurationReader {
  get<T>(section: string, defaultValue: T): T;
}

export type FimFormat = "codestral" | "openai" | "qwen" | "seed";

export interface ReticleSettings {
  apiKey: string;
  baseURL: string;
  debounceMs: number;
  enableAutoTrigger: boolean;
  extraHeaders: Record<string, string>;
  fimFormat: FimFormat;
  languageAllowlist: string[];
  languageDenylist: string[];
  maxLines: number;
  maxTokens: number;
  model: string;
  multiFileContext: boolean;
  temperature: number;
}

export class SettingsError extends Error {
  override readonly name = "SettingsError";
}

function stringValue(
  configuration: ConfigurationReader,
  section: string,
  fallback: string,
): string {
  const value = configuration.get<unknown>(section, fallback);
  if (typeof value !== "string") {
    throw new SettingsError(`Reticle: reticle.${section} must be a string.`);
  }
  return value.trim();
}

function numberValue(
  configuration: ConfigurationReader,
  section: string,
  fallback: number,
): number {
  const value = configuration.get<unknown>(section, fallback);
  if (typeof value !== "number") {
    throw new SettingsError(`Reticle: reticle.${section} must be a number.`);
  }
  return value;
}

function booleanValue(
  configuration: ConfigurationReader,
  section: string,
  fallback: boolean,
): boolean {
  const value = configuration.get<unknown>(section, fallback);
  if (typeof value !== "boolean") {
    throw new SettingsError(`Reticle: reticle.${section} must be true or false.`);
  }
  return value;
}

function fimFormatValue(configuration: ConfigurationReader): FimFormat {
  const value = stringValue(configuration, "fimFormat", "openai");
  if (value !== "codestral" && value !== "openai" && value !== "qwen" && value !== "seed") {
    throw new SettingsError(
      'Reticle: reticle.fimFormat must be "codestral", "openai", "qwen", or "seed".',
    );
  }
  return value;
}

function stringList(value: unknown, section: string): string[] {
  if (!Array.isArray(value)) {
    throw new SettingsError(`Reticle: reticle.${section} must be an array of language IDs.`);
  }
  if (!value.every((item) => typeof item === "string")) {
    throw new SettingsError(`Reticle: every reticle.${section} entry must be a string.`);
  }
  return [...new Set(value.map((item) => item.trim().toLowerCase()).filter(Boolean))];
}

export function isLanguageEnabled(
  settings: Pick<ReticleSettings, "languageAllowlist" | "languageDenylist">,
  languageId: string,
): boolean {
  const normalized = languageId.toLowerCase();
  if (settings.languageDenylist.includes(normalized)) {
    return false;
  }
  return settings.languageAllowlist.length === 0 || settings.languageAllowlist.includes(normalized);
}

function stringHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SettingsError("Reticle: reticle.extraHeaders must be an object of string values.");
  }
  if (!Object.values(value).every((item) => typeof item === "string")) {
    throw new SettingsError("Reticle: every reticle.extraHeaders value must be a string.");
  }
  return Object.fromEntries(Object.entries(value).filter(([name]) => Boolean(name.trim())));
}

export function readSettings(configuration: ConfigurationReader): ReticleSettings {
  return {
    apiKey: stringValue(configuration, "apiKey", ""),
    baseURL: stringValue(configuration, "baseURL", "http://127.0.0.1:8001/v1"),
    debounceMs: clampDebounceMs(numberValue(configuration, "debounceMs", 100)),
    enableAutoTrigger: booleanValue(configuration, "enableAutoTrigger", true),
    extraHeaders: stringHeaders(configuration.get<unknown>("extraHeaders", {})),
    fimFormat: fimFormatValue(configuration),
    languageAllowlist: stringList(
      configuration.get<unknown>("languageAllowlist", []),
      "languageAllowlist",
    ),
    languageDenylist: stringList(
      configuration.get<unknown>("languageDenylist", []),
      "languageDenylist",
    ),
    maxLines: numberValue(configuration, "maxLines", 8),
    maxTokens: numberValue(configuration, "maxTokens", 256),
    model: stringValue(configuration, "model", ""),
    multiFileContext: booleanValue(configuration, "multiFileContext", false),
    temperature: numberValue(configuration, "temperature", 0),
  };
}

export function isLoopbackURL(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (hostname === "localhost" ||
        hostname.endsWith(".localhost") ||
        /^127(?:\.\d{1,3}){3}$/.test(hostname) ||
        hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

export function validateSettings(settings: ReticleSettings): ReticleSettings {
  let endpoint: URL;
  try {
    endpoint = new URL(settings.baseURL);
  } catch {
    throw new SettingsError(
      "Reticle: Base URL is invalid. Set reticle.baseURL to an http(s) OpenAI-compatible /v1 endpoint.",
    );
  }
  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    throw new SettingsError("Reticle: Base URL must use http or https.");
  }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new SettingsError(
      "Reticle: Base URL must not contain credentials, a query string, or a fragment. Put credentials in reticle.apiKey or reticle.extraHeaders.",
    );
  }
  if (!settings.model) {
    throw new SettingsError(
      "Reticle: No model is configured. Set reticle.model to the FIM model ID reported by /v1/models.",
    );
  }
  const loopback = isLoopbackURL(settings.baseURL);
  if (!loopback && !settings.apiKey) {
    throw new SettingsError(
      "Reticle: Remote endpoints require reticle.apiKey. Add the provider key in Settings, or use a keyless loopback URL such as http://127.0.0.1:8001/v1.",
    );
  }
  if (!loopback && endpoint.protocol !== "https:") {
    throw new SettingsError(
      "Reticle: Remote endpoints must use https so the API key and source context are encrypted in transit.",
    );
  }
  if (!Number.isInteger(settings.maxLines) || settings.maxLines < 1 || settings.maxLines > 64) {
    throw new SettingsError("Reticle: reticle.maxLines must be an integer from 1 to 64.");
  }
  if (
    !Number.isInteger(settings.maxTokens) ||
    settings.maxTokens < 1 ||
    settings.maxTokens > 2_048
  ) {
    throw new SettingsError("Reticle: reticle.maxTokens must be an integer from 1 to 2048.");
  }
  if (
    !Number.isFinite(settings.temperature) ||
    settings.temperature < 0 ||
    settings.temperature > 2
  ) {
    throw new SettingsError("Reticle: reticle.temperature must be a number from 0 to 2.");
  }
  for (const [name, value] of Object.entries(settings.extraHeaders)) {
    if (/[:\r\n]/.test(name) || /[\r\n]/.test(value)) {
      throw new SettingsError(
        `Reticle: extra header ${JSON.stringify(name)} contains invalid characters.`,
      );
    }
  }
  return settings;
}
