import { buildCompletionsRequest, completionsUrl } from "../completion/request.js";
import { buildCompletionHeaders, createSessionId } from "../completion/session.js";
import { streamCompletion, type Fetch } from "../completion/stream.js";
import {
  reachedZetaBoundary,
  sanitizeZetaCompletion,
  zetaCursorInsertion,
  zetaEditableRegion,
} from "../completion/zeta.js";
import type { ReticleSettings } from "./settings.js";

export const PROBE_PREFIX = "function select(user: User) {\n  const value = user.";
export const PROBE_SUFFIX =
  ";\n  return value;\n}\ninterface User { suffixOnlyIdentifier: string }\n";

export type ProbeClassification = "insertion" | "prose" | "fenced" | "empty" | "unexpected";

export interface ProbeResult {
  classification: ProbeClassification;
  elapsedMs: number;
  text: string;
}

export type UnsupportedResponse = "prose" | "fenced";

const PROSE_START =
  /^(?:here(?:'s| is)|sure[,.!]|certainly[,.!]|the (?:completed|corrected|answer)|to (?:complete|fix)|this (?:code|function)|it (?:looks|seems)|you(?:'re| are)|i(?:'d| would| can)|as an ai)\b/i;

export function classifyProbeResponse(value: string): ProbeClassification {
  const trimmed = value.trim();
  if (!trimmed) {
    return "empty";
  }
  const unsupported = classifyUnsupportedResponse(trimmed);
  if (unsupported) {
    return unsupported;
  }
  const firstLine = trimmed.split(/\r?\n/, 1)[0]?.trim() ?? "";
  if (/^suffixOnlyIdentifier\s*;?$/.test(firstLine)) {
    const remainder = trimmed.slice(trimmed.indexOf(firstLine) + firstLine.length).trim();
    if (!remainder || /^}/.test(remainder)) {
      return "insertion";
    }
  }
  return "unexpected";
}

export function classifyUnsupportedResponse(value: string): UnsupportedResponse | undefined {
  const trimmed = value.trim();
  if (/(?:```|~~~)/.test(trimmed)) {
    return "fenced";
  }
  return PROSE_START.test(trimmed) ||
    /\b(?:here is|corrected version|code block|markdown|explanation)\b/i.test(trimmed) ||
    /(?:^|\r?\n)\s*(?:this (?:function|code)|the (?:result|function)|it (?:returns|adds))\b/i.test(
      trimmed,
    )
    ? "prose"
    : undefined;
}

export async function probeEndpoint(
  settings: ReticleSettings,
  options: { fetch?: Fetch; signal?: AbortSignal } = {},
): Promise<ProbeResult> {
  const controller = options.signal ? undefined : new AbortController();
  const signal = options.signal ?? controller!.signal;
  const body = buildCompletionsRequest(
    PROBE_PREFIX,
    PROBE_SUFFIX,
    settings.model,
    {
      fimFormat: settings.fimFormat,
      maxTokens: Math.min(settings.maxTokens, 64),
      temperature: 0,
    },
    "reticle_probe.ts",
  );
  const sessionId = createSessionId(settings.model, "reticle://endpoint-probe");
  const startedAt = performance.now();
  const raw = await streamCompletion({
    url: completionsUrl(settings.baseURL),
    body,
    headers: buildCompletionHeaders(sessionId, settings.extraHeaders, settings.apiKey),
    signal,
    fetch: options.fetch,
    shouldStop: settings.fimFormat === "zeta" ? reachedZetaBoundary : undefined,
  });
  const zetaRegion = zetaEditableRegion(PROBE_PREFIX, PROBE_SUFFIX);
  const text =
    settings.fimFormat === "zeta"
      ? zetaCursorInsertion(sanitizeZetaCompletion(raw, zetaRegion, settings.maxLines), zetaRegion)
      : raw;
  return {
    classification: classifyProbeResponse(text),
    elapsedMs: Math.round(performance.now() - startedAt),
    text,
  };
}
