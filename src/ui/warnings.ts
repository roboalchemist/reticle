import * as vscode from "vscode";

import type { ProbeResult, UnsupportedResponse } from "../config/probe.js";

const shownCompatibilityWarnings = new Set<string>();

export function probeVerdictMessage(result: ProbeResult): string {
  switch (result.classification) {
    case "insertion":
      return `Reticle endpoint passed the FIM probe in ${result.elapsedMs} ms.`;
    case "fenced":
      return "Reticle endpoint responds with fenced Markdown. This is chat-model behavior; select a FIM base model that returns only the missing insertion.";
    case "prose":
      return "Reticle endpoint responds as chat prose. Chat/instruct models are not supported; select a FIM base model exposed through /v1/completions.";
    case "empty":
      return "Reticle endpoint returned no insertion. Confirm the model supports prompt + suffix fill-in-the-middle completions.";
    case "unexpected":
      return "Reticle endpoint responded, but not with the expected `a + b` insertion. Confirm the selected model is FIM-capable.";
  }
}

export async function showCompletionCompatibilityWarning(
  classification: UnsupportedResponse,
  model: string,
  baseURL: string,
): Promise<void> {
  const key = `${baseURL}\0${model}\0${classification}`;
  if (shownCompatibilityWarnings.has(key)) {
    return;
  }
  shownCompatibilityWarnings.add(key);
  const behavior = classification === "fenced" ? "fenced Markdown" : "chat prose";
  const action = await vscode.window.showWarningMessage(
    `Reticle received ${behavior} from ${model}. Chat-style output cannot be inserted as autocomplete; select a FIM base/completion model.`,
    "Open Reticle Settings",
  );
  if (action === "Open Reticle Settings") {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "@ext:roboalchemist.reticle",
    );
  }
}

export async function showProbeVerdict(result: ProbeResult): Promise<void> {
  const message = probeVerdictMessage(result);
  if (result.classification === "insertion") {
    await vscode.window.showInformationMessage(message);
    return;
  }

  const action = await vscode.window.showWarningMessage(message, "Open Reticle Settings");
  if (action === "Open Reticle Settings") {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "@ext:roboalchemist.reticle",
    );
  }
}
