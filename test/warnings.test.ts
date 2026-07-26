import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeCommand, showInformationMessage, showWarningMessage } = vi.hoisted(() => ({
  showInformationMessage: vi
    .fn<(message: string) => Promise<undefined>>()
    .mockResolvedValue(undefined),
  showWarningMessage: vi
    .fn<(message: string, ...items: string[]) => Promise<string | undefined>>()
    .mockResolvedValue(undefined),
  executeCommand: vi
    .fn<(command: string, ...arguments_: unknown[]) => Promise<undefined>>()
    .mockResolvedValue(undefined),
}));

vi.mock("vscode", () => ({
  window: { showInformationMessage, showWarningMessage },
  commands: { executeCommand },
}));

import {
  probeVerdictMessage,
  showCompletionCompatibilityWarning,
  showProbeVerdict,
} from "../src/ui/warnings.js";

describe("probe warning surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses specific chat and fenced-Markdown guidance", () => {
    expect(probeVerdictMessage({ classification: "prose", elapsedMs: 1, text: "chat" })).toContain(
      "responds as chat prose",
    );
    expect(
      probeVerdictMessage({ classification: "fenced", elapsedMs: 1, text: "fence" }),
    ).toContain("fenced Markdown");
  });

  it("shows failures as an in-editor warning and passes as information", async () => {
    await showProbeVerdict({ classification: "prose", elapsedMs: 1, text: "chat" });
    expect(showWarningMessage).toHaveBeenCalledOnce();
    expect(showInformationMessage).not.toHaveBeenCalled();

    await showProbeVerdict({ classification: "insertion", elapsedMs: 42, text: "a + b" });
    expect(showInformationMessage).toHaveBeenCalledWith(
      "Reticle endpoint passed the FIM probe in 42 ms.",
    );
  });

  it("surfaces live chat behavior once per endpoint/model", async () => {
    showWarningMessage.mockResolvedValueOnce("Open Reticle Settings");
    await showCompletionCompatibilityWarning("fenced", "chat-model", "https://example.test/v1");
    await showCompletionCompatibilityWarning("fenced", "chat-model", "https://example.test/v1");
    expect(showWarningMessage).toHaveBeenCalledOnce();
    expect(showWarningMessage.mock.calls[0]?.[0]).toContain("fenced Markdown");
    expect(executeCommand).toHaveBeenCalledWith(
      "workbench.action.openSettings",
      "@ext:roboalchemist.reticle",
    );
  });
});
