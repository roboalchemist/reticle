import { beforeEach, describe, expect, it, vi } from "vitest";

const { showWarningMessage } = vi.hoisted(() => ({
  showWarningMessage: vi.fn<(message: string, ...items: string[]) => Promise<string | undefined>>(),
}));

const settings: Record<string, unknown> = {
  apiKey: "",
  baseURL: "http://localhost:8001/v1",
  debounceMs: 75,
  extraHeaders: {},
  fimFormat: "openai",
  maxLines: 8,
  maxTokens: 16,
  model: "fim-model",
  temperature: 0,
};

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: (key: string, fallback: unknown) => settings[key] ?? fallback,
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
  Position: class Position {
    constructor(
      public readonly line: number,
      public readonly character: number,
    ) {}
  },
  InlineCompletionTriggerKind: { Invoke: 0, Automatic: 1 },
  window: { showWarningMessage },
  commands: { executeCommand: vi.fn() },
}));

const token = {
  isCancellationRequested: false,
  onCancellationRequested: () => ({ dispose: () => undefined }),
};

const position = {};
const document = {
  getText: () => "return ",
  offsetAt: () => 7,
  languageId: "javascript",
  version: 1,
  uri: { toString: () => "file:///repo/file.js" },
};

describe("inline provider request coordination", () => {
  beforeEach(() => {
    settings.model = "fim-model";
    settings.enableAutoTrigger = true;
    settings.languageAllowlist = [];
    settings.languageDenylist = [];
    settings.fimFormat = "openai";
    settings.maxLines = 8;
    settings.multiFileContext = false;
    showWarningMessage.mockReset().mockResolvedValue(undefined);
  });

  it("aborts an in-flight completion before starting the next edit", async () => {
    const { InlineProvider } = await import("../src/completion/InlineProvider.js");
    let calls = 0;
    let firstAborted = false;
    const fetch = (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      calls += 1;
      if (calls === 1) {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            firstAborted = true;
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }
      return Promise.resolve(
        new Response('{"choices":[{"text":"a + b"}]}', {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    };
    const provider = new InlineProvider({ fetch });

    const stale = provider.provideInlineCompletionItems(
      document as never,
      position as never,
      { triggerKind: 1 } as never,
      token,
    );
    await new Promise((resolve) => setTimeout(resolve, 90));
    const current = provider.provideInlineCompletionItems(
      document as never,
      position as never,
      { triggerKind: 1 } as never,
      token,
    );

    await expect(stale).resolves.toEqual({ items: [] });
    const result = await current;
    expect(firstAborted).toBe(true);
    expect(calls).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.insertText).toBe("a + b");
    provider.dispose();
  });

  it("keeps different documents independent and runs manual requests immediately", async () => {
    const { InlineProvider } = await import("../src/completion/InlineProvider.js");
    let calls = 0;
    let firstAborted = false;
    const fetch = (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      calls += 1;
      if (calls === 1) {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            firstAborted = true;
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }
      return Promise.resolve(
        new Response('{"choices":[{"text":"second"}]}', {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    };
    const provider = new InlineProvider({ fetch });
    const stale = provider.provideInlineCompletionItems(
      document as never,
      position as never,
      { triggerKind: 1 } as never,
      token,
    );
    await new Promise((resolve) => setTimeout(resolve, 90));

    const otherDocument = {
      ...document,
      uri: { toString: () => "file:///repo/other.js" },
    };
    const current = await provider.provideInlineCompletionItems(
      otherDocument as never,
      position as never,
      { triggerKind: 0 } as never,
      token,
    );

    expect(firstAborted).toBe(false);
    expect(current.items[0]?.insertText).toBe("second");
    provider.cancelPendingRequest("file:///repo/file.js");
    await expect(stale).resolves.toEqual({ items: [] });
    expect(firstAborted).toBe(true);
    provider.dispose();
  });

  it("stops the live stream at an identifier boundary", async () => {
    const { InlineProvider } = await import("../src/completion/InlineProvider.js");
    const events = [
      { choices: [{ text: "Name " }] },
      { choices: [{ text: "```javascript\nignored rewrite\n```" }] },
    ]
      .map((event) => `data: ${JSON.stringify(event)}\n\n`)
      .join("");
    const fetch = () =>
      Promise.resolve(
        new Response(`${events}data: [DONE]\n\n`, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      );
    const identifierDocument = {
      ...document,
      getText: () => "return user.display",
      offsetAt: () => 19,
    };
    const provider = new InlineProvider({ fetch });

    const result = await provider.provideInlineCompletionItems(
      identifierDocument as never,
      position as never,
      { triggerKind: 0 } as never,
      token,
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.insertText).toBe("Name");
    expect(showWarningMessage).not.toHaveBeenCalled();
    provider.dispose();
  });

  it("returns a bounded multi-line insertion with indentation intact", async () => {
    const { InlineProvider } = await import("../src/completion/InlineProvider.js");
    settings.maxLines = 2;
    const fetch = () =>
      Promise.resolve(
        new Response(
          '{"choices":[{"text":"const name = getName();\\n  return name;\\n  ignored();"}]}',
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    const provider = new InlineProvider({ fetch });

    const result = await provider.provideInlineCompletionItems(
      document as never,
      position as never,
      { triggerKind: 0 } as never,
      token,
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.insertText).toBe("const name = getName();\n  return name;");
    provider.dispose();
  });

  it("turns a marker-wrapped Zeta line rewrite into a replacement suggestion", async () => {
    const { InlineProvider } = await import("../src/completion/InlineProvider.js");
    settings.fimFormat = "zeta";
    settings.model = "default_model";
    const beforeCursor = "  const value = user.";
    const prefix = `function f() {\n${beforeCursor}`;
    const suffix = ";\n}\n";
    let request: Record<string, unknown> | undefined;
    const events = [
      { choices: [{ text: "<|marker_1|>  const value = user.name;" }] },
      { choices: [{ text: "<|marker_2|>" }] },
      { choices: [{ text: "ignored protocol overflow" }] },
    ]
      .map((event) => `data: ${JSON.stringify(event)}\n\n`)
      .join("");
    const fetch = (_input: string | URL | Request, init?: RequestInit) => {
      request = JSON.parse(typeof init?.body === "string" ? init.body : "") as Record<
        string,
        unknown
      >;
      return Promise.resolve(
        new Response(`${events}data: [DONE]\n\n`, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      );
    };
    const lineStartOffset = "function f() {\n".length;
    const zetaDocument = {
      ...document,
      getText: () => prefix + suffix,
      offsetAt: (value: { line: number; character: number }) =>
        value.line === 1 ? lineStartOffset + value.character : 0,
      uri: {
        path: "/repo/src/file.ts",
        toString: () => "file:///repo/src/file.ts",
      },
    };
    const zetaPosition = { line: 1, character: beforeCursor.length };
    const provider = new InlineProvider({ fetch });

    const result = await provider.provideInlineCompletionItems(
      zetaDocument as never,
      zetaPosition as never,
      { triggerKind: 0 } as never,
      token,
    );

    expect(request?.prompt).toContain("<filename>repo/src/file.ts");
    expect(request?.prompt).toContain(
      "<|marker_1|>  const value = user.<|user_cursor|>;<|marker_2|>",
    );
    expect(result.items[0]?.insertText).toBe("  const value = user.name;");
    expect(result.items[0]?.range).toMatchObject({
      start: { line: 1, character: 0 },
      end: { line: 1, character: beforeCursor.length + 1 },
    });
    expect(
      provider.recordDocumentChange(
        { uri: zetaDocument.uri, version: 2 } as never,
        [{ rangeOffset: lineStartOffset, text: "  const value = user.name;" }] as never,
      ),
    ).toBe(true);
    provider.dispose();
  });

  it("suppresses post-accept auto-triggering until the next real edit", async () => {
    const { InlineProvider } = await import("../src/completion/InlineProvider.js");
    const fetch = vi.fn(() =>
      Promise.resolve(
        new Response('{"choices":[{"text":"first();\\n  second();"}]}', {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const provider = new InlineProvider({ fetch });
    const offered = await provider.provideInlineCompletionItems(
      document as never,
      position as never,
      { triggerKind: 1 } as never,
      token,
    );
    const insertion = offered.items[0]?.insertText;
    expect(insertion).toBe("first();\n  second();");
    if (typeof insertion !== "string") {
      throw new TypeError("Expected a string insertion.");
    }

    expect(
      provider.recordDocumentChange(
        { uri: document.uri, version: 2 } as never,
        [{ rangeOffset: 7, text: insertion }] as never,
      ),
    ).toBe(true);
    await expect(
      provider.provideInlineCompletionItems(
        { ...document, version: 2 } as never,
        position as never,
        { triggerKind: 1 } as never,
        token,
      ),
    ).resolves.toEqual({ items: [] });
    expect(fetch).toHaveBeenCalledTimes(1);

    const manual = await provider.provideInlineCompletionItems(
      { ...document, version: 2 } as never,
      position as never,
      { triggerKind: 0 } as never,
      token,
    );
    expect(manual.items).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(2);

    expect(
      provider.recordDocumentChange(
        { uri: document.uri, version: 3 } as never,
        [{ rangeOffset: 7 + insertion.length, text: "x" }] as never,
      ),
    ).toBe(false);
    const afterEdit = await provider.provideInlineCompletionItems(
      { ...document, version: 3 } as never,
      position as never,
      { triggerKind: 1 } as never,
      token,
    );
    expect(afterEdit.items).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(3);
    provider.dispose();
  });

  it("suppresses ghost text when a fence follows a plausible first line", async () => {
    const { InlineProvider } = await import("../src/completion/InlineProvider.js");
    settings.model = "chat-model";
    const events = [
      { choices: [{ text: "a + b\n" }] },
      { choices: [{ text: "```javascript\nfull rewrite\n```" }] },
    ]
      .map((event) => `data: ${JSON.stringify(event)}\n\n`)
      .join("");
    const fetch = () =>
      Promise.resolve(
        new Response(`${events}data: [DONE]\n\n`, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      );
    const provider = new InlineProvider({ fetch });
    const result = await provider.provideInlineCompletionItems(
      document as never,
      position as never,
      { triggerKind: 0 } as never,
      token,
    );

    expect(result.items).toEqual([]);
    expect(showWarningMessage).toHaveBeenCalledOnce();
    provider.dispose();
  });

  it("short-circuits disabled, denied, and non-allowlisted documents", async () => {
    const { InlineProvider } = await import("../src/completion/InlineProvider.js");
    const fetch = vi.fn(() =>
      Promise.resolve(
        new Response('{"choices":[{"text":"suggestion"}]}', {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const onStatusChange = vi.fn();
    const provider = new InlineProvider({ fetch, onStatusChange });

    settings.enableAutoTrigger = false;
    settings.model = "";
    await provider.provideInlineCompletionItems(
      document as never,
      position as never,
      { triggerKind: 0 } as never,
      token,
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(onStatusChange).toHaveBeenCalledWith("disabled");

    settings.enableAutoTrigger = true;
    settings.languageDenylist = ["javascript"];
    await provider.provideInlineCompletionItems(
      document as never,
      position as never,
      { triggerKind: 0 } as never,
      token,
    );
    settings.languageDenylist = [];
    settings.languageAllowlist = ["python"];
    await provider.provideInlineCompletionItems(
      document as never,
      position as never,
      { triggerKind: 0 } as never,
      token,
    );
    expect(fetch).not.toHaveBeenCalled();
    provider.dispose();
  });

  it("does not let an aborted request overwrite a newly disabled status", async () => {
    const { InlineProvider } = await import("../src/completion/InlineProvider.js");
    const fetch = (_input: string | URL | Request, init?: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      });
    const onStatusChange = vi.fn();
    const provider = new InlineProvider({ fetch, onStatusChange });
    const pending = provider.provideInlineCompletionItems(
      document as never,
      position as never,
      { triggerKind: 0 } as never,
      token,
    );
    settings.enableAutoTrigger = false;
    provider.cancelPendingRequest();
    await pending;

    expect(onStatusChange).toHaveBeenLastCalledWith("disabled");
    provider.dispose();
  });

  it("surfaces failures and backs off after three endpoint errors", async () => {
    const { InlineProvider } = await import("../src/completion/InlineProvider.js");
    const fetch = vi.fn(() =>
      Promise.resolve(new Response("secret detail", { status: 500, statusText: "Failure" })),
    );
    const onStatusChange = vi.fn();
    const provider = new InlineProvider({ fetch, onStatusChange });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await provider.provideInlineCompletionItems(
        document as never,
        position as never,
        { triggerKind: 1 } as never,
        token,
      );
    }

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(onStatusChange).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("retrying endpoint"),
    );
    provider.dispose();
  });

  it("does not consult or alter the request with multi-file context disabled", async () => {
    const { InlineProvider } = await import("../src/completion/InlineProvider.js");
    let request: Record<string, unknown> | undefined;
    const fetch = vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      if (typeof init?.body !== "string") {
        throw new TypeError("expected a JSON request body");
      }
      request = JSON.parse(init.body) as Record<string, unknown>;
      return Promise.resolve(
        new Response('{"choices":[{"text":"value"}]}', {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });
    const contextProvider = { buildContext: vi.fn(() => "// context") };
    const provider = new InlineProvider({ fetch, contextProvider });

    await provider.provideInlineCompletionItems(
      document as never,
      position as never,
      { triggerKind: 0 } as never,
      token,
    );

    expect(contextProvider.buildContext).not.toHaveBeenCalled();
    expect(request).toMatchObject({ prompt: "return ", suffix: "" });
    provider.dispose();
  });

  it("adds opt-in context only to the bounded request prefix", async () => {
    const { InlineProvider } = await import("../src/completion/InlineProvider.js");
    settings.multiFileContext = true;
    let request: Record<string, unknown> | undefined;
    const fetch = vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      if (typeof init?.body !== "string") {
        throw new TypeError("expected a JSON request body");
      }
      request = JSON.parse(init.body) as Record<string, unknown>;
      return Promise.resolve(
        new Response('{"choices":[{"text":"value"}]}', {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });
    const contextProvider = { buildContext: vi.fn(() => "// helper signature") };
    const provider = new InlineProvider({ fetch, contextProvider });

    await provider.provideInlineCompletionItems(
      document as never,
      position as never,
      { triggerKind: 0 } as never,
      token,
    );

    expect(contextProvider.buildContext).toHaveBeenCalledOnce();
    expect(request).toMatchObject({
      prompt: "// helper signature\n\nreturn ",
      suffix: "",
      model: "fim-model",
      stream: true,
    });
    provider.dispose();
  });
});
