export const ZETA_REGION_START = "<|marker_1|>";
export const ZETA_CURSOR = "<|user_cursor|>";
export const ZETA_REGION_END = "<|marker_2|>";

export interface ZetaEditableRegion {
  beforeCursor: string;
  afterCursor: string;
  beforeRegion: string;
  afterRegion: string;
  original: string;
}

/**
 * Map ordinary cursor-local FIM onto Zeta's rewrite protocol. The current
 * logical line is the smallest useful editable region; the rest remains
 * prefix/suffix context and is not replaced when the suggestion is accepted.
 */
export function zetaEditableRegion(prefix: string, suffix: string): ZetaEditableRegion {
  const lineStart = prefix.lastIndexOf("\n") + 1;
  const nextLine = suffix.indexOf("\n");
  const lineEnd = nextLine === -1 ? suffix.length : nextLine;
  const beforeCursor = prefix.slice(lineStart);
  const afterCursor = suffix.slice(0, lineEnd);
  return {
    beforeCursor,
    afterCursor,
    beforeRegion: prefix.slice(0, lineStart),
    afterRegion: suffix.slice(lineEnd),
    original: beforeCursor + afterCursor,
  };
}

export function buildZetaPrompt(prefix: string, suffix: string, fileName: string): string {
  const region = zetaEditableRegion(prefix, suffix);
  const safeFileName = fileName.trim() || "current_file";
  return (
    `<[fim-suffix]>${region.afterRegion}` +
    `<[fim-prefix]><filename>${safeFileName}\n${region.beforeRegion}` +
    `${ZETA_REGION_START}${region.beforeCursor}${ZETA_CURSOR}${region.afterCursor}` +
    `${ZETA_REGION_END}<[fim-middle]>`
  );
}

function firstMeaningfulSuffixLine(suffix: string): string | undefined {
  return suffix
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .find((line) => line.trim().length > 0);
}

/**
 * Extract a complete marker-wrapped Zeta rewrite and trim any outer suffix the
 * model copied into the region. Incomplete or malformed protocol output is
 * rejected rather than exposed as editor text.
 */
export function sanitizeZetaCompletion(
  value: string,
  region: ZetaEditableRegion,
  maximumLines = 8,
): string {
  const normalized = value.replaceAll("\0", "").replace(/\r\n?/g, "\n");
  const start = normalized.indexOf(ZETA_REGION_START);
  if (start === -1) {
    return "";
  }
  const contentStart = start + ZETA_REGION_START.length;
  const end = normalized.indexOf(ZETA_REGION_END, contentStart);
  if (end === -1) {
    return "";
  }

  let rewrite = normalized.slice(contentStart, end).replaceAll(ZETA_CURSOR, "");
  if (/<\|marker_\d+\|>/.test(rewrite) || rewrite.includes("<[fim-")) {
    return "";
  }

  const suffixLine = firstMeaningfulSuffixLine(region.afterRegion);
  if (suffixLine) {
    const boundary = rewrite.indexOf(`\n${suffixLine}`);
    if (boundary >= 0) {
      rewrite = rewrite.slice(0, boundary);
    }
  }

  rewrite = rewrite.split("\n").slice(0, maximumLines).join("\n").replace(/\n+$/g, "");
  return rewrite === region.original ? "" : rewrite;
}

export function reachedZetaBoundary(value: string): boolean {
  return value.includes(ZETA_REGION_END);
}

export function zetaCursorInsertion(rewrite: string, region: ZetaEditableRegion): string {
  if (!rewrite.startsWith(region.beforeCursor) || !rewrite.endsWith(region.afterCursor)) {
    return "";
  }
  return rewrite.slice(region.beforeCursor.length, rewrite.length - region.afterCursor.length);
}
