import { expect, it, vi } from "vitest";

import { isLoopbackURL } from "../../src/config/settings.js";

const { settings, showWarningMessage } = vi.hoisted(() => ({
  settings: {
    apiKey: process.env.RETICLE_INTEGRATION_API_KEY ?? "",
    baseURL: process.env.RETICLE_INTEGRATION_BASE_URL ?? "http://127.0.0.1:8001/v1",
    debounceMs: 75,
    enableAutoTrigger: true,
    extraHeaders: {},
    fimFormat:
      process.env.RETICLE_INTEGRATION_FIM_FORMAT === "qwen"
        ? ("qwen" as const)
        : ("openai" as const),
    languageAllowlist: [],
    languageDenylist: [],
    maxTokens: 64,
    model: process.env.RETICLE_INTEGRATION_MODEL ?? "",
    multiFileContext: false,
    temperature: 0,
  },
  showWarningMessage: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: (key: string, fallback: unknown) => {
        const value: unknown = Reflect.get(settings, key);
        return value ?? fallback;
      },
    }),
  },
  InlineCompletionItem: class InlineCompletionItem {
    constructor(
      public readonly insertText: string,
      public readonly range: unknown,
    ) {}
  },
  Range: class Range {
    constructor(
      public readonly start: unknown,
      public readonly end: unknown,
    ) {}
  },
  InlineCompletionTriggerKind: { Invoke: 0, Automatic: 1 },
  window: { showWarningMessage },
  commands: { executeCommand: vi.fn() },
}));

it("produces a clean provider insertion from a live OpenAI-compatible FIM endpoint", async () => {
  if (process.env.RETICLE_INTEGRATION !== "1") {
    throw new Error("Set RETICLE_INTEGRATION=1 to acknowledge the live network test.");
  }
  if (!settings.model) {
    throw new Error("Set RETICLE_INTEGRATION_MODEL to the live endpoint's FIM-capable model ID.");
  }
  if (!isLoopbackURL(settings.baseURL)) {
    throw new Error("The live integration harness only permits loopback endpoint URLs.");
  }
  const { InlineProvider } = await import("../../src/completion/InlineProvider.js");
  const output: string[] = [];
  const provider = new InlineProvider({
    fetch: globalThis.fetch,
    output: { appendLine: (line) => output.push(line) },
  });
  const prefix = "function select(user: User) {\n  const value = user.";
  const suffix = ";\n  return value;\n}\ninterface User { suffixOnlyIdentifier: string }\n";
  const text = `${prefix}${suffix}`;
  const position = { line: 1, character: "  const value = user.".length };
  const document = {
    getText: () => text,
    offsetAt: () => prefix.length,
    languageId: "javascript",
    version: 1,
    uri: { toString: () => "file:///reticle-integration/add.js" },
  };
  const token = {
    isCancellationRequested: false,
    onCancellationRequested: () => ({ dispose: () => undefined }),
  };

  try {
    const result = await provider.provideInlineCompletionItems(
      document as never,
      position as never,
      { triggerKind: 0 } as never,
      token,
    );
    const insertion = result.items[0]?.insertText;
    expect(output, output.join("\n")).toEqual([]);
    expect(showWarningMessage).not.toHaveBeenCalled();
    if (typeof insertion !== "string") {
      throw new TypeError("Expected the provider to return a plain string insertion.");
    }
    expect(insertion).toMatch(/^suffixOnlyIdentifier;?$/u);
  } finally {
    provider.dispose();
  }
}, 120_000);
