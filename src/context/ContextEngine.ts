export interface ContextDocument {
  readonly languageId: string;
  readonly uri: {
    readonly scheme?: string;
    readonly path?: string;
    readonly fsPath?: string;
    toString(): string;
  };
  getText(): string;
}

export interface ContextEngineOptions {
  getOpenDocuments: () => readonly ContextDocument[];
  getWorkspaceKey?: (document: ContextDocument) => string | undefined;
  isEnabled?: () => boolean;
  maxContextCharacters?: number;
  maxSnippetCharacters?: number;
}

interface RankedDocument {
  document: ContextDocument;
  identifiers: readonly string[];
  score: number;
  text: string;
}

const DEFAULT_MAX_CONTEXT_CHARACTERS = 8_000;
const DEFAULT_MAX_SNIPPET_CHARACTERS = 2_400;
const MAX_CANDIDATES = 24;
const MAX_DOCUMENT_SCAN_CHARACTERS = 64_000;
const MAX_RECENT_DOCUMENTS = 8;

function supportedScheme(document: ContextDocument): boolean {
  const scheme = document.uri.scheme ?? document.uri.toString().split(":", 1)[0];
  return scheme === "file" || scheme === "untitled";
}

function documentName(document: ContextDocument): string {
  const location = document.uri.path ?? document.uri.fsPath ?? document.uri.toString();
  const normalized = location.replaceAll("\\", "/").replace(/[?#].*$/u, "");
  return normalized.split("/").filter(Boolean).at(-1) ?? "untitled";
}

function identifiers(text: string): string[] {
  const matches = text.match(/[A-Za-z_$][\w$]{2,}/gu) ?? [];
  return [...new Set(matches)].slice(-80);
}

function relevantSnippet(text: string, candidates: readonly string[], limit: number): string {
  const lower = text.toLowerCase();
  const match = candidates.find((candidate) => lower.includes(candidate.toLowerCase()));
  let start = match ? lower.indexOf(match.toLowerCase()) : 0;
  start = Math.max(0, start - Math.floor(limit / 3));
  const precedingLine = text.lastIndexOf("\n", start);
  if (precedingLine >= 0) {
    start = precedingLine + 1;
  }
  let snippet = text.slice(start, start + limit);
  const finalLine = snippet.lastIndexOf("\n");
  if (finalLine > limit / 2) {
    snippet = snippet.slice(0, finalLine);
  }
  return snippet.trim();
}

function commentLines(languageId: string, content: string): string {
  if (new Set(["html", "xml", "vue", "svelte", "markdown"]).has(languageId)) {
    return `<!--\n${content.replaceAll("-->", "-- >")}\n-->`;
  }
  if (new Set(["css", "scss", "less", "json", "jsonc"]).has(languageId)) {
    return `/*\n${content.replaceAll("*/", "* /")}\n*/`;
  }
  const prefix = new Set(["python", "ruby", "shellscript", "r", "perl", "yaml", "toml"]).has(
    languageId,
  )
    ? "#"
    : new Set(["sql", "lua", "haskell"]).has(languageId)
      ? "--"
      : "//";
  return content
    .split("\n")
    .map((line) => `${prefix} ${line}`.trimEnd())
    .join("\n");
}

function boundedCommentBlock(languageId: string, content: string, limit: number): string {
  let low = 0;
  let high = content.length;
  let result = "";
  while (low <= high) {
    const length = Math.floor((low + high) / 2);
    const candidate = commentLines(languageId, content.slice(0, length));
    if (candidate.length <= limit) {
      result = candidate;
      low = length + 1;
    } else {
      high = length - 1;
    }
  }
  return result;
}

export class ContextEngine {
  private readonly recency = new Map<string, number>();
  private readonly recentDocuments = new Map<string, ContextDocument>();
  private sequence = 0;

  constructor(private readonly options: ContextEngineOptions) {}

  recordEdit(document: ContextDocument): void {
    if (this.options.isEnabled?.() === false || !supportedScheme(document)) {
      return;
    }
    const uri = document.uri.toString();
    const text = document.getText().slice(0, MAX_DOCUMENT_SCAN_CHARACTERS);
    const snapshot: ContextDocument = {
      languageId: document.languageId,
      uri: document.uri,
      getText: () => text,
    };
    this.recency.set(uri, ++this.sequence);
    this.recentDocuments.delete(uri);
    this.recentDocuments.set(uri, snapshot);
    while (this.recentDocuments.size > MAX_RECENT_DOCUMENTS) {
      const oldest = this.recentDocuments.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.recentDocuments.delete(oldest);
      this.recency.delete(oldest);
    }
  }

  buildContext(currentDocument: ContextDocument, currentPrefix: string): string {
    if (this.options.isEnabled?.() === false) {
      return "";
    }
    const maxContext = this.options.maxContextCharacters ?? DEFAULT_MAX_CONTEXT_CHARACTERS;
    const maxSnippet = this.options.maxSnippetCharacters ?? DEFAULT_MAX_SNIPPET_CHARACTERS;
    if (maxContext <= 0 || maxSnippet <= 0) {
      return "";
    }

    const currentUri = currentDocument.uri.toString();
    const workspaceKey = this.options.getWorkspaceKey?.(currentDocument);
    const currentIdentifiers = identifiers(currentPrefix);
    const openDocuments = this.options.getOpenDocuments();
    const openUris = new Set(openDocuments.map((document) => document.uri.toString()));
    const candidateDocuments = [
      ...openDocuments,
      ...[...this.recentDocuments.values()].filter(
        (document) => !openUris.has(document.uri.toString()),
      ),
    ]
      .filter(
        (document) =>
          document.uri.toString() !== currentUri &&
          supportedScheme(document) &&
          (this.options.getWorkspaceKey === undefined ||
            (workspaceKey !== undefined &&
              this.options.getWorkspaceKey(document) === workspaceKey)),
      )
      .sort((left, right) => {
        const languageDifference =
          Number(right.languageId === currentDocument.languageId) -
          Number(left.languageId === currentDocument.languageId);
        if (languageDifference !== 0) {
          return languageDifference;
        }
        return (
          (this.recency.get(right.uri.toString()) ?? 0) -
          (this.recency.get(left.uri.toString()) ?? 0)
        );
      })
      .slice(0, MAX_CANDIDATES);
    const ranked: RankedDocument[] = candidateDocuments
      .map((document) => {
        const text = document.getText().slice(0, MAX_DOCUMENT_SCAN_CHARACTERS);
        const lower = text.toLowerCase();
        const matched = currentIdentifiers.filter((identifier) =>
          lower.includes(identifier.toLowerCase()),
        );
        const editedAt = this.recency.get(document.uri.toString());
        const recencyBonus =
          editedAt === undefined ? 0 : Math.max(1, 50 - Math.min(49, this.sequence - editedAt));
        const score =
          (document.languageId === currentDocument.languageId ? 1_000 : 0) +
          matched.length * 100 +
          recencyBonus;
        return { document, identifiers: matched, score, text };
      })
      .filter((candidate) => candidate.text.trim())
      .sort((left, right) => right.score - left.score);

    let result = "";
    for (const candidate of ranked) {
      const snippet = relevantSnippet(
        candidate.text,
        candidate.identifiers.length > 0 ? candidate.identifiers : currentIdentifiers,
        maxSnippet,
      );
      if (!snippet) {
        continue;
      }
      const separator = result ? "\n" : "";
      const remaining = maxContext - result.length - separator.length;
      if (remaining <= 0) {
        break;
      }
      const block = boundedCommentBlock(
        currentDocument.languageId,
        `[Reticle context: ${documentName(candidate.document)}]\n${snippet}`,
        remaining,
      );
      if (!block) {
        break;
      }
      result += separator + block;
    }
    return result;
  }

  clear(): void {
    this.recency.clear();
    this.recentDocuments.clear();
    this.sequence = 0;
  }
}

export function prependContext(
  prefix: string,
  context: string,
  maxPrefixCharacters = 16_000,
): string {
  if (!context || maxPrefixCharacters <= 0) {
    return prefix.slice(-Math.max(0, maxPrefixCharacters));
  }
  const separator = "\n\n";
  const boundedContext = context.slice(0, maxPrefixCharacters);
  const localBudget = Math.max(0, maxPrefixCharacters - boundedContext.length - separator.length);
  return `${boundedContext}${separator}${prefix.slice(-localBudget)}`.slice(-maxPrefixCharacters);
}
