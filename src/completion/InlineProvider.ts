import * as vscode from "vscode";

import { CompletionDebouncer } from "./debounce.js";
import { ErrorBackoff } from "./backoff.js";
import { buildCompletionsRequest, completionsUrl } from "./request.js";
import { reachedGuardedInlineBoundary, sanitizeCompletion } from "./sanitize.js";
import { buildCompletionHeaders, createSessionId } from "./session.js";
import { isAbortError, streamCompletion, type Fetch } from "./stream.js";
import {
  isLanguageEnabled,
  readSettings,
  validateSettings,
  type ReticleSettings,
} from "../config/settings.js";
import { classifyUnsupportedResponse } from "../config/probe.js";
import { showCompletionCompatibilityWarning } from "../ui/warnings.js";
import type { ReticleStatus } from "../ui/statusBar.js";
import { prependContext, type ContextDocument } from "../context/ContextEngine.js";

const MAX_PREFIX_CHARACTERS = 16_000;
const MAX_SUFFIX_CHARACTERS = 4_000;

export interface InlineProviderOptions {
  output?: Pick<vscode.OutputChannel, "appendLine">;
  fetch?: Fetch;
  onStatusChange?: (state: ReticleStatus, detail?: string) => void;
  contextProvider?: {
    buildContext(document: ContextDocument, currentPrefix: string): string;
  };
}

interface DocumentRequestState {
  activeRequest?: AbortController;
  debouncer: CompletionDebouncer;
  version: number;
}

function documentContext(
  document: vscode.TextDocument,
  position: vscode.Position,
): {
  prefix: string;
  suffix: string;
} {
  const text = document.getText();
  const offset = document.offsetAt(position);
  return {
    prefix: text.slice(Math.max(0, offset - MAX_PREFIX_CHARACTERS), offset),
    suffix: text.slice(offset, offset + MAX_SUFFIX_CHARACTERS),
  };
}

export class InlineProvider implements vscode.InlineCompletionItemProvider, vscode.Disposable {
  private readonly requests = new Map<string, DocumentRequestState>();
  private readonly backoff = new ErrorBackoff();
  private activeNetworkRequests = 0;

  constructor(private readonly options: InlineProviderOptions = {}) {}

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionList> {
    const documentScope = document.uri.toString();
    const state = this.getRequestState(documentScope);
    this.cancelPendingRequest(documentScope);
    const requestVersion = ++state.version;
    const configuration = vscode.workspace.getConfiguration("reticle");
    const enabled = configuration.get<unknown>("enableAutoTrigger", true);
    if (enabled === false) {
      this.requests.delete(documentScope);
      this.options.onStatusChange?.("disabled");
      return { items: [] };
    }
    const allowlist = configuration.get<unknown>("languageAllowlist", []);
    const denylist = configuration.get<unknown>("languageDenylist", []);
    if (
      Array.isArray(allowlist) &&
      allowlist.every((item) => typeof item === "string") &&
      Array.isArray(denylist) &&
      denylist.every((item) => typeof item === "string") &&
      !isLanguageEnabled(
        {
          languageAllowlist: allowlist.map((item) => item.trim().toLowerCase()),
          languageDenylist: denylist.map((item) => item.trim().toLowerCase()),
        },
        document.languageId,
      )
    ) {
      this.requests.delete(documentScope);
      return { items: [] };
    }
    let settings: ReticleSettings;
    try {
      settings = validateSettings(readSettings(configuration));
    } catch (error) {
      this.requests.delete(documentScope);
      const message = error instanceof Error ? error.message : String(error);
      this.options.output?.appendLine(`[configuration] ${message}`);
      this.options.onStatusChange?.("error", message);
      return { items: [] };
    }
    const manual = context.triggerKind === vscode.InlineCompletionTriggerKind.Invoke;
    if (!this.backoff.canRequest() && !manual) {
      this.requests.delete(documentScope);
      const seconds = Math.max(1, Math.ceil(this.backoff.retryInMs() / 1_000));
      this.options.onStatusChange?.("error", `retrying endpoint in ${seconds}s`);
      return { items: [] };
    }

    const ready = manual ? true : await state.debouncer.wait(settings.debounceMs);
    if (!ready || token.isCancellationRequested || requestVersion !== state.version) {
      return { items: [] };
    }

    const controller = new AbortController();
    state.activeRequest = controller;
    this.activeNetworkRequests += 1;
    this.options.onStatusChange?.("working");
    const cancellation = token.onCancellationRequested(() => controller.abort());
    const documentVersion = document.version;
    const localContext = documentContext(document, position);
    const prefix = settings.multiFileContext
      ? prependContext(
          localContext.prefix,
          this.options.contextProvider?.buildContext(document, localContext.prefix) ?? "",
          MAX_PREFIX_CHARACTERS,
        )
      : localContext.prefix;
    const suffix = localContext.suffix;
    const sanitizeContext = { languageId: document.languageId, prefix, suffix };
    let requestFailed = false;

    try {
      const body = buildCompletionsRequest(prefix, suffix, settings.model, settings);
      const sessionId = createSessionId(settings.model, documentScope);
      const headers = buildCompletionHeaders(sessionId, settings.extraHeaders, settings.apiKey);
      const raw = await streamCompletion({
        url: completionsUrl(settings.baseURL),
        body,
        headers,
        signal: controller.signal,
        fetch: this.options.fetch,
        shouldStop: (completion) => reachedGuardedInlineBoundary(completion, sanitizeContext),
      });

      const unsupported = classifyUnsupportedResponse(raw);
      this.backoff.recordSuccess();
      if (unsupported) {
        await showCompletionCompatibilityWarning(unsupported, settings.model, settings.baseURL);
        return { items: [] };
      }

      if (
        token.isCancellationRequested ||
        requestVersion !== state.version ||
        document.version !== documentVersion
      ) {
        return { items: [] };
      }

      const insertion = sanitizeCompletion(raw, sanitizeContext);
      if (!insertion) {
        return { items: [] };
      }
      return {
        items: [new vscode.InlineCompletionItem(insertion, new vscode.Range(position, position))],
      };
    } catch (error) {
      if (!isAbortError(error)) {
        requestFailed = true;
        const message = error instanceof Error ? error.message : String(error);
        this.options.output?.appendLine(`[autocomplete] ${message}`);
        const snapshot = this.backoff.recordFailure();
        const detail =
          snapshot.retryAt > Date.now()
            ? `${message} Retrying after backoff.`
            : `${message} (${snapshot.consecutiveFailures}/${3} failures before backoff)`;
        this.options.onStatusChange?.("error", detail);
      }
      return { items: [] };
    } finally {
      this.activeNetworkRequests = Math.max(0, this.activeNetworkRequests - 1);
      cancellation.dispose();
      if (state.activeRequest === controller) {
        state.activeRequest = undefined;
      }
      if (requestVersion === state.version && !state.activeRequest) {
        state.debouncer.dispose();
        this.requests.delete(documentScope);
      }
      if (!requestFailed && this.activeNetworkRequests === 0 && this.backoff.canRequest()) {
        const autoEnabled = vscode.workspace
          .getConfiguration("reticle")
          .get<unknown>("enableAutoTrigger", true);
        this.options.onStatusChange?.(autoEnabled === false ? "disabled" : "enabled");
      }
    }
  }

  private getRequestState(documentScope: string): DocumentRequestState {
    const existing = this.requests.get(documentScope);
    if (existing) {
      return existing;
    }
    const state: DocumentRequestState = { debouncer: new CompletionDebouncer(), version: 0 };
    this.requests.set(documentScope, state);
    return state;
  }

  cancelPendingRequest(documentScope?: string): void {
    const states = documentScope
      ? [[documentScope, this.requests.get(documentScope)] as const]
      : [...this.requests.entries()];
    for (const [scope, state] of states) {
      if (!state) {
        continue;
      }
      state.debouncer.cancel();
      state.activeRequest?.abort();
      state.activeRequest = undefined;
      if (!documentScope) {
        this.requests.delete(scope);
      }
    }
  }

  resetEndpointHealth(): void {
    this.backoff.recordSuccess();
  }

  dispose(): void {
    this.cancelPendingRequest();
  }
}
