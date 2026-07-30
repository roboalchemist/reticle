import {
  validateSettings,
  type FimFormat,
  type ReticleSettings,
  SettingsError,
} from "../config/settings.js";

export interface PanelSettings {
  baseURL: string;
  debounceMs: number;
  enableAutoTrigger: boolean;
  fimFormat: FimFormat;
  maxLines: number;
  maxTokens: number;
  model: string;
  multiFileContext: boolean;
  temperature: number;
}

export const PANEL_SETTING_KEYS = [
  "baseURL",
  "model",
  "fimFormat",
  "maxTokens",
  "maxLines",
  "temperature",
  "debounceMs",
  "enableAutoTrigger",
  "multiFileContext",
] as const satisfies readonly (keyof PanelSettings)[];

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SettingsError("Reticle: panel settings must be an object.");
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, key: string): string {
  if (typeof value !== "string") {
    throw new SettingsError(`Reticle: reticle.${key} must be a string.`);
  }
  return value.trim();
}

function numberValue(value: unknown, key: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new SettingsError(`Reticle: reticle.${key} must be a number.`);
  }
  return value;
}

function booleanValue(value: unknown, key: string): boolean {
  if (typeof value !== "boolean") {
    throw new SettingsError(`Reticle: reticle.${key} must be true or false.`);
  }
  return value;
}

function fimFormatValue(value: unknown): FimFormat {
  if (value === "codestral" || value === "openai" || value === "qwen" || value === "seed") {
    return value;
  }
  throw new SettingsError(
    'Reticle: reticle.fimFormat must be "codestral", "openai", "qwen", or "seed".',
  );
}

export function panelSettingsFrom(settings: ReticleSettings): PanelSettings {
  return {
    baseURL: settings.baseURL,
    debounceMs: settings.debounceMs,
    enableAutoTrigger: settings.enableAutoTrigger,
    fimFormat: settings.fimFormat,
    maxLines: settings.maxLines,
    maxTokens: settings.maxTokens,
    model: settings.model,
    multiFileContext: settings.multiFileContext,
    temperature: settings.temperature,
  };
}

export function mergePanelSettings(current: ReticleSettings, value: unknown): ReticleSettings {
  const candidate = objectValue(value);
  const debounceMs = numberValue(candidate.debounceMs, "debounceMs");
  if (!Number.isInteger(debounceMs) || debounceMs < 75 || debounceMs > 150) {
    throw new SettingsError("Reticle: reticle.debounceMs must be an integer from 75 to 150.");
  }

  return validateSettings({
    ...current,
    baseURL: stringValue(candidate.baseURL, "baseURL"),
    debounceMs,
    enableAutoTrigger: booleanValue(candidate.enableAutoTrigger, "enableAutoTrigger"),
    fimFormat: fimFormatValue(candidate.fimFormat),
    maxLines: numberValue(candidate.maxLines, "maxLines"),
    maxTokens: numberValue(candidate.maxTokens, "maxTokens"),
    model: stringValue(candidate.model, "model"),
    multiFileContext: booleanValue(candidate.multiFileContext, "multiFileContext"),
    temperature: numberValue(candidate.temperature, "temperature"),
  });
}
