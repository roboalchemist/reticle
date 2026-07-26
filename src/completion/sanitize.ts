const DEFAULT_IDENTIFIER = /[\p{L}\p{M}\p{N}_]/u;

function identifierCharacterPattern(languageId: string): RegExp {
  switch (languageId) {
    case "css":
    case "less":
    case "scss":
      return /[\p{L}\p{M}\p{N}_-]/u;
    case "clojure":
    case "fsharp":
    case "lisp":
    case "scheme":
      return /[\p{L}\p{M}\p{N}_?!*+-]/u;
    case "php":
    case "ruby":
      return /[\p{L}\p{M}\p{N}_$?!]/u;
    case "javascript":
    case "javascriptreact":
    case "perl":
    case "powershell":
    case "shellscript":
    case "typescript":
    case "typescriptreact":
      return /[\p{L}\p{M}\p{N}_$]/u;
    default:
      return DEFAULT_IDENTIFIER;
  }
}

function firstCharacter(value: string): string {
  return value[Symbol.iterator]().next().value ?? "";
}

function lastCharacter(value: string): string {
  let last = "";
  for (const character of value) {
    last = character;
  }
  return last;
}

function stripMarkdownFence(value: string): string {
  if (/^\s*```[^\r\n]*\s*$/.test(value)) {
    return "";
  }
  const opening = value.match(/^\s*```[^\r\n]*\r?\n/);
  if (!opening) {
    return value;
  }

  const body = value.slice(opening[0].length);
  const closingIndex = body.search(/\r?\n\s*```/);
  return closingIndex === -1 ? body : body.slice(0, closingIndex);
}

function firstLine(value: string): string {
  const newline = value.search(/[\r\n]/);
  return newline === -1 ? value : value.slice(0, newline);
}

export interface SanitizeContext {
  languageId: string;
  prefix: string;
  suffix?: string;
}

function removeCursorOverlap(value: string, context: SanitizeContext): string {
  let insertion = value;
  if (/\s/.test(context.prefix.at(-1) ?? "")) {
    insertion = insertion.replace(/^[\t ]+/, "");
  }

  const suffix = context.suffix ?? "";
  const firstSuffixCharacter = firstCharacter(suffix);
  const maximum = Math.min(insertion.length, suffix.length, 100);
  for (let length = maximum; length > 0; length -= 1) {
    if (length === firstSuffixCharacter.length && DEFAULT_IDENTIFIER.test(firstSuffixCharacter)) {
      continue;
    }
    if (insertion.endsWith(suffix.slice(0, length))) {
      return insertion.slice(0, -length);
    }
  }
  return insertion;
}

/**
 * Keep inline output to one line and use identifier trimming only for identifier
 * continuations. General expressions such as `a + b` remain intact after `return `.
 */
export function sanitizeCompletion(value: string, context: SanitizeContext): string {
  const withoutFence = stripMarkdownFence(value.replaceAll("\0", ""));
  const line = removeCursorOverlap(
    firstLine(withoutFence).replace(/<\|fim_(?:prefix|suffix|middle)\|>/g, ""),
    context,
  );
  const pattern = identifierCharacterPattern(context.languageId);
  const previous = lastCharacter(context.prefix);
  const first = firstCharacter(line);

  if (!pattern.test(previous) || !pattern.test(first)) {
    return line;
  }

  let boundary = 0;
  for (const character of line) {
    if (!pattern.test(character)) {
      break;
    }
    boundary += character.length;
  }
  return line.slice(0, boundary);
}

export function reachedInlineBoundary(value: string, context: SanitizeContext): boolean {
  if (/[\r\n]/.test(value)) {
    return true;
  }

  const pattern = identifierCharacterPattern(context.languageId);
  const previous = lastCharacter(context.prefix);
  if (!pattern.test(previous)) {
    return false;
  }

  for (const character of value) {
    if (!pattern.test(character)) {
      return true;
    }
  }
  return false;
}

/** Keep a tiny lookahead after a newline so a following SSE fence remains visible. */
export function reachedGuardedInlineBoundary(value: string, context: SanitizeContext): boolean {
  const newline = value.search(/[\r\n]/);
  if (newline === -1) {
    return reachedInlineBoundary(value, context);
  }
  return value.slice(newline + 1).trimStart().length >= 3;
}
