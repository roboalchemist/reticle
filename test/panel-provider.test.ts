import { beforeEach, describe, expect, it, vi } from "vitest";

const vscodeMock = vi.hoisted(() => {
  const values: Record<string, unknown> = {
    apiKey: "",
    baseURL: "http://127.0.0.1:8001/v1",
    debounceMs: 100,
    enableAutoTrigger: true,
    extraHeaders: {},
    fimFormat: "qwen",
    languageAllowlist: [],
    languageDenylist: [],
    maxLines: 8,
    maxTokens: 64,
    model: "default_model",
    multiFileContext: false,
    temperature: 0,
  };
  const configuration = {
    get: vi.fn((key: string, fallback: unknown) => values[key] ?? fallback),
    inspect: vi.fn(() => undefined),
    update: vi.fn((key: string, value: unknown) => {
      values[key] = value;
      return Promise.resolve();
    }),
  };
  return {
    clipboardWrite: vi.fn(() => Promise.resolve()),
    configuration,
    executeCommand: vi.fn(() => Promise.resolve()),
    reset: () => {
      values.model = "default_model";
      values.maxLines = 8;
      configuration.get.mockClear();
      configuration.inspect.mockClear();
      configuration.update.mockClear();
    },
  };
});

vi.mock("vscode", () => ({
  commands: { executeCommand: vscodeMock.executeCommand },
  ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
  env: { clipboard: { writeText: vscodeMock.clipboardWrite } },
  Uri: { joinPath: () => ({ toString: () => "file:///extension/media/icon.svg" }) },
  window: { activeTextEditor: { document: { uri: {} } } },
  workspace: { getConfiguration: () => vscodeMock.configuration },
}));

import { ReticleLogStore } from "../src/ui/logStore.js";
import { ReticlePanelProvider } from "../src/ui/ReticlePanelProvider.js";

describe("Reticle panel provider", () => {
  beforeEach(() => {
    vscodeMock.reset();
    vscodeMock.clipboardWrite.mockClear();
    vscodeMock.executeCommand.mockClear();
  });

  it("drives health, settings, completion-test, and log actions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: string | URL | Request, init?: RequestInit) => {
        if (init?.method === "GET") {
          return Promise.resolve(
            new Response(
              '{"data":[{"id":"mlx-community/zed-industries-zeta-4bit"},{"id":"default_model"}]}',
              { status: 200 },
            ),
          );
        }
        return Promise.resolve(
          new Response('{"choices":[{"text":"suffixOnlyIdentifier"}]}', {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }),
    );
    const output = {
      appendLine: vi.fn(),
      clear: vi.fn(),
      show: vi.fn(),
    };
    const logs = new ReticleLogStore(output);
    const provider = new ReticlePanelProvider({} as never, logs);
    let receiveMessage: ((message: unknown) => void) | undefined;
    const postMessage = vi.fn<(message: unknown) => Promise<boolean>>(() => Promise.resolve(true));
    const postedStates = (): Array<{
      state?: { availableModels?: string[]; health?: { status?: string } };
      type?: string;
    }> =>
      postMessage.mock.calls.map(
        ([message]) =>
          message as {
            state?: { availableModels?: string[]; health?: { status?: string } };
            type?: string;
          },
      );
    const view = {
      onDidChangeVisibility: vi.fn(() => ({ dispose: vi.fn() })),
      visible: true,
      webview: {
        cspSource: "vscode-webview://reticle",
        html: "",
        asWebviewUri: vi.fn(() => ({
          toString: () => "vscode-webview://reticle/media/icon.svg",
        })),
        onDidReceiveMessage: vi.fn((callback: (message: unknown) => void) => {
          receiveMessage = callback;
          return { dispose: vi.fn() };
        }),
        options: {},
        postMessage,
      },
    };

    try {
      provider.resolveWebviewView(view as never);
      expect(view.webview.html).toContain("Endpoint health");
      await vi.waitFor(() => {
        expect(
          postedStates().some(
            (message) => message.type === "state" && message.state?.health?.status === "healthy",
          ),
        ).toBe(true);
      });
      expect(
        postedStates().some(
          (message) =>
            message.type === "state" &&
            message.state?.availableModels?.includes("mlx-community/zed-industries-zeta-4bit"),
        ),
      ).toBe(true);

      receiveMessage?.({
        settings: {
          apiKey: "ignored",
          baseURL: "http://127.0.0.1:8001/v1",
          debounceMs: 100,
          enableAutoTrigger: true,
          fimFormat: "qwen",
          maxLines: 12,
          maxTokens: 64,
          model: "next-model",
          multiFileContext: false,
          temperature: 0,
        },
        type: "saveSettings",
      });
      await vi.waitFor(() => {
        expect(vscodeMock.configuration.update).toHaveBeenCalledWith("model", "next-model", 1);
        expect(vscodeMock.configuration.update).toHaveBeenCalledWith("maxLines", 12, 1);
      });

      receiveMessage?.({ type: "triggerCompletion" });
      await vi.waitFor(() => {
        expect(vscodeMock.executeCommand).toHaveBeenCalledWith(
          "workbench.action.focusActiveEditorGroup",
        );
        expect(vscodeMock.executeCommand).toHaveBeenCalledWith("reticle.triggerCompletion");
      });

      receiveMessage?.({ type: "copyLogs" });
      await vi.waitFor(() => expect(vscodeMock.clipboardWrite).toHaveBeenCalledOnce());
      expect(vscodeMock.clipboardWrite).toHaveBeenCalledWith(
        expect.stringContaining("[completion]"),
      );

      receiveMessage?.({ type: "openOutput" });
      expect(output.show).toHaveBeenCalledWith(true);
      receiveMessage?.({ type: "openSettings" });
      await vi.waitFor(() => {
        expect(vscodeMock.executeCommand).toHaveBeenCalledWith(
          "workbench.action.openSettings",
          "@ext:roboalchemist.reticle",
        );
      });
      receiveMessage?.({ type: "clearLogs" });
      expect(output.clear).toHaveBeenCalledOnce();
    } finally {
      provider.dispose();
    }
  });
});
