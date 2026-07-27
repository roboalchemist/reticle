import type { FimFormat } from "../config/settings.js";

export interface CompletionRequestSettings {
  fimFormat: FimFormat;
  maxTokens: number;
  temperature: number;
}

export interface OpenAICompletionsRequest {
  model: string;
  prompt: string;
  suffix: string;
  max_tokens: number;
  stop?: string[];
  temperature: number;
  stream: true;
}

const QWEN_FIM_PREFIX = "<|fim_prefix|>";
const QWEN_FIM_SUFFIX = "<|fim_suffix|>";
const QWEN_FIM_MIDDLE = "<|fim_middle|>";
const SEED_FIM_PREFIX = "<[fim-prefix]>";
const SEED_FIM_SUFFIX = "<[fim-suffix]>";
const SEED_FIM_MIDDLE = "<[fim-middle]>";
const CODESTRAL_FIM_PREFIX = "[PREFIX]";
const CODESTRAL_FIM_SUFFIX = "[SUFFIX]";

function codestralStopSequence(suffix: string): string {
  const firstLine = suffix.split(/\r?\n/, 1)[0] ?? "";
  return firstLine.length > 0 ? firstLine : "\n";
}

/** Build an OpenAI completions request with the configured FIM serialization. */
export function buildCompletionsRequest(
  prefix: string,
  suffix: string,
  model: string,
  settings: CompletionRequestSettings,
): OpenAICompletionsRequest {
  if (settings.fimFormat === "qwen") {
    return {
      model,
      prompt: `${QWEN_FIM_PREFIX}${prefix}${QWEN_FIM_SUFFIX}${suffix}${QWEN_FIM_MIDDLE}`,
      suffix: "",
      max_tokens: settings.maxTokens,
      stop: ["<|fim_pad|>", "<|endoftext|>"],
      temperature: settings.temperature,
      stream: true,
    };
  }
  if (settings.fimFormat === "seed") {
    return {
      model,
      prompt: `${SEED_FIM_SUFFIX}${suffix}${SEED_FIM_PREFIX}${prefix}${SEED_FIM_MIDDLE}`,
      suffix: "",
      max_tokens: settings.maxTokens,
      stop: [codestralStopSequence(suffix), "</s>"],
      temperature: settings.temperature,
      stream: true,
    };
  }
  if (settings.fimFormat === "codestral") {
    return {
      model,
      prompt: `${CODESTRAL_FIM_SUFFIX}${suffix}${CODESTRAL_FIM_PREFIX}${prefix}`,
      suffix: "",
      max_tokens: settings.maxTokens,
      temperature: settings.temperature,
      stream: true,
    };
  }
  return {
    model,
    prompt: prefix,
    suffix,
    max_tokens: settings.maxTokens,
    temperature: settings.temperature,
    stream: true,
  };
}

export function completionsUrl(baseURL: string): string {
  const normalized = baseURL.trim().replace(/\/+$/, "");
  if (/\/completions$/i.test(normalized)) {
    return normalized;
  }
  return `${normalized}/completions`;
}
