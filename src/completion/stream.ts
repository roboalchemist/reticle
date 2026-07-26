import type { OpenAICompletionsRequest } from "./request.js";

export type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface StreamCompletionOptions {
  url: string;
  body: OpenAICompletionsRequest;
  headers: Readonly<Record<string, string>>;
  signal: AbortSignal;
  fetch?: Fetch;
  shouldStop?: (completion: string) => boolean;
}

function completionText(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") {
    return "";
  }
  const text = (choices[0] as { text?: unknown }).text;
  return typeof text === "string" ? text : "";
}

export function parseSseData(data: string): string {
  const trimmed = data.trim();
  if (!trimmed || trimmed === "[DONE]") {
    return "";
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return "";
  }
  if (parsed && typeof parsed === "object" && "error" in parsed) {
    const error = parsed.error;
    const message =
      typeof error === "string"
        ? error
        : error && typeof error === "object" && "message" in error
          ? String(error.message)
          : JSON.stringify(error);
    throw new Error(`Autocomplete stream error: ${message}`);
  }
  return completionText(parsed);
}

async function readStreamingResponse(
  response: Response,
  signal: AbortSignal,
  shouldStop?: (completion: string) => boolean,
): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventData: string[] = [];
  let completion = "";

  const flushEvent = (): boolean => {
    if (eventData.length === 0) {
      return false;
    }
    const data = eventData.join("\n");
    eventData = [];
    if (data.trim() === "[DONE]") {
      return true;
    }
    completion += parseSseData(data);
    return shouldStop?.(completion) ?? false;
  };

  try {
    while (true) {
      if (signal.aborted) {
        throw signal.reason ?? new DOMException("Aborted", "AbortError");
      }
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        if (!line) {
          if (flushEvent()) {
            await reader.cancel();
            return completion;
          }
        } else if (line.startsWith("data:")) {
          eventData.push(line.slice(5).trimStart());
        }
        newline = buffer.indexOf("\n");
      }

      if (done) {
        if (buffer.startsWith("data:")) {
          eventData.push(buffer.slice(5).trimStart());
        }
        flushEvent();
        return completion;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function streamCompletion(options: StreamCompletionOptions): Promise<string> {
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  const response = await fetchImplementation(options.url, {
    method: "POST",
    headers: options.headers,
    body: JSON.stringify(options.body),
    signal: options.signal,
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Autocomplete endpoint returned ${response.status} ${response.statusText}.`);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    return completionText(await response.json());
  }
  return readStreamingResponse(response, options.signal, options.shouldStop);
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}
