import { createHash } from "node:crypto";

export const SESSION_HEADER = "x-reticle-autocomplete-session-id";

/** Stable and opaque for one model/document pair; changes when either scope changes. */
export function createSessionId(model: string, documentScope: string): string {
  return createHash("sha256")
    .update(model, "utf8")
    .update("\0", "utf8")
    .update(documentScope, "utf8")
    .digest("hex");
}

export function buildCompletionHeaders(
  sessionId: string,
  extraHeaders: Readonly<Record<string, string>> = {},
  apiKey?: string,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(extraHeaders)) {
    const normalized = name.toLowerCase();
    if (normalized === "content-type" || normalized === SESSION_HEADER) {
      continue;
    }
    if (normalized === "authorization" && apiKey?.trim()) {
      continue;
    }
    headers[name] = value;
  }
  headers["Content-Type"] = "application/json";

  if (apiKey?.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }

  // Cache identity is owned by Reticle and cannot be accidentally replaced by configuration.
  headers[SESSION_HEADER] = sessionId;
  return headers;
}
