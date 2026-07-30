import { buildCompletionHeaders } from "../completion/session.js";
import type { Fetch } from "../completion/stream.js";
import type { ReticleSettings } from "./settings.js";

export interface EndpointHealthResult {
  elapsedMs: number;
  message: string;
  status: "healthy" | "unhealthy";
}

export function modelsUrl(baseURL: string): string {
  const normalized = baseURL.trim().replace(/\/+$/, "");
  if (/\/completions$/i.test(normalized)) {
    return `${normalized.replace(/\/completions$/i, "")}/models`;
  }
  if (/\/models$/i.test(normalized)) {
    return normalized;
  }
  return `${normalized}/models`;
}

export async function checkEndpointHealth(
  settings: ReticleSettings,
  options: { fetch?: Fetch; signal?: AbortSignal } = {},
): Promise<EndpointHealthResult> {
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  const startedAt = performance.now();

  try {
    const response = await fetchImplementation(modelsUrl(settings.baseURL), {
      method: "GET",
      headers: buildCompletionHeaders(
        "reticle-panel-health",
        settings.extraHeaders,
        settings.apiKey,
      ),
      signal: options.signal,
    });
    await response.body?.cancel();
    const elapsedMs = Math.round(performance.now() - startedAt);
    if (response.ok) {
      return {
        elapsedMs,
        message: `Reachable in ${elapsedMs} ms`,
        status: "healthy",
      };
    }
    return {
      elapsedMs,
      message: `HTTP ${response.status} ${response.statusText}`.trim(),
      status: "unhealthy",
    };
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - startedAt);
    const message = error instanceof Error ? error.message : String(error);
    return {
      elapsedMs,
      message,
      status: "unhealthy",
    };
  }
}
