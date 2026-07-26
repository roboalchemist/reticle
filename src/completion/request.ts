export interface CompletionRequestSettings {
  maxTokens: number;
  temperature: number;
}

export interface OpenAICompletionsRequest {
  model: string;
  prompt: string;
  suffix: string;
  max_tokens: number;
  temperature: number;
  stream: true;
}

/** Build the validated OpenAI-compatible FIM request without provider-specific wrapping. */
export function buildCompletionsRequest(
  prefix: string,
  suffix: string,
  model: string,
  settings: CompletionRequestSettings,
): OpenAICompletionsRequest {
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
