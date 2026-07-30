import { buildCompletionHeaders } from "../completion/session.js";
import type { Fetch } from "../completion/stream.js";
import type { ReticleSettings } from "./settings.js";

export interface EndpointHealthResult {
  elapsedMs: number;
  message: string;
  modelIds: string[];
  status: "healthy" | "unhealthy";
}

const MAX_MODEL_COUNT = 500;
const MAX_MODEL_ID_LENGTH = 512;

export function modelIdsFromResponse(value: unknown): string[] {
  if (!value || typeof value !== "object" || !("data" in value)) {
    return [];
  }
  const data = (value as { data?: unknown }).data;
  if (!Array.isArray(data)) {
    return [];
  }

  const ids = new Set<string>();
  for (const entry of data) {
    if (!entry || typeof entry !== "object" || !("id" in entry)) {
      continue;
    }
    const id = (entry as { id?: unknown }).id;
    if (typeof id !== "string") {
      continue;
    }
    const normalized = id.trim();
    if (normalized.length === 0 || normalized.length > MAX_MODEL_ID_LENGTH || ids.has(normalized)) {
      continue;
    }
    ids.add(normalized);
    if (ids.size === MAX_MODEL_COUNT) {
      break;
    }
  }
  return [...ids].sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );
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
    const elapsedMs = Math.round(performance.now() - startedAt);
    if (response.ok) {
      let modelIds: string[] = [];
      try {
        modelIds = modelIdsFromResponse(await response.json());
      } catch {
        // Health is still valid when a compatible endpoint omits a JSON model list.
      }
      return {
        elapsedMs,
        message: `Reachable in ${elapsedMs} ms`,
        modelIds,
        status: "healthy",
      };
    }
    await response.body?.cancel();
    return {
      elapsedMs,
      message: `HTTP ${response.status} ${response.statusText}`.trim(),
      modelIds: [],
      status: "unhealthy",
    };
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - startedAt);
    const message = error instanceof Error ? error.message : String(error);
    return {
      elapsedMs,
      message,
      modelIds: [],
      status: "unhealthy",
    };
  }
}
