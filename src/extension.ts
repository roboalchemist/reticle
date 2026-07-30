import * as vscode from "vscode";

import { InlineProvider } from "./completion/InlineProvider.js";
import { probeEndpoint } from "./config/probe.js";
import { readSettings, SettingsError, validateSettings } from "./config/settings.js";
import { showProbeVerdict } from "./ui/warnings.js";
import { StatusBarController } from "./ui/statusBar.js";
import { ContextEngine } from "./context/ContextEngine.js";
import { ReticleLogStore } from "./ui/logStore.js";
import { ReticlePanelProvider } from "./ui/ReticlePanelProvider.js";

export interface ReticleExtensionApi {
  provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    inlineContext: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): ReturnType<InlineProvider["provideInlineCompletionItems"]>;
}

export function activate(context: vscode.ExtensionContext): ReticleExtensionApi {
  const selector: vscode.DocumentSelector = [{ scheme: "file" }, { scheme: "untitled" }];
  const output = vscode.window.createOutputChannel("Reticle", { log: true });
  const logs = new ReticleLogStore(output);
  const configuration = vscode.workspace.getConfiguration("reticle");
  const status = new StatusBarController(
    configuration.get<boolean>("enableAutoTrigger", true) ? "enabled" : "disabled",
  );
  const panel = new ReticlePanelProvider(context.extensionUri, logs);
  const setStatus = (state: Parameters<StatusBarController["setState"]>[0], detail?: string) => {
    status.setState(state, detail);
    panel.setAutocompleteStatus(state, detail);
  };
  const contextEngine = new ContextEngine({
    getOpenDocuments: () => vscode.workspace.textDocuments,
    getWorkspaceKey: (document) =>
      vscode.workspace.getWorkspaceFolder(document.uri as vscode.Uri)?.uri.toString(),
    isEnabled: () =>
      vscode.workspace.getConfiguration("reticle").get<boolean>("multiFileContext", false),
  });
  const provider = new InlineProvider({
    output: logs,
    onStatusChange: setStatus,
    contextProvider: contextEngine,
  });

  context.subscriptions.push(
    output,
    panel,
    status,
    provider,
    vscode.window.registerWebviewViewProvider(ReticlePanelProvider.viewID, panel, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.languages.registerInlineCompletionItemProvider(selector, provider),
    vscode.workspace.onDidChangeTextDocument((event) => {
      provider.recordDocumentChange(event.document, event.contentChanges);
      if (vscode.workspace.getConfiguration("reticle").get<boolean>("multiFileContext", false)) {
        contextEngine.recordEdit(event.document);
      }
    }),
    vscode.commands.registerCommand("reticle.toggle", async () => {
      const resource =
        vscode.window.activeTextEditor?.document.uri ??
        (vscode.workspace.workspaceFolders?.length === 1
          ? vscode.workspace.workspaceFolders[0]?.uri
          : undefined);
      const configuration = vscode.workspace.getConfiguration("reticle", resource);
      const enabled = configuration.get<boolean>("enableAutoTrigger", true);
      const inspected = configuration.inspect<boolean>("enableAutoTrigger");
      const target =
        inspected?.workspaceFolderValue !== undefined
          ? vscode.ConfigurationTarget.WorkspaceFolder
          : inspected?.workspaceValue !== undefined
            ? vscode.ConfigurationTarget.Workspace
            : vscode.ConfigurationTarget.Global;
      await configuration.update("enableAutoTrigger", !enabled, target);
      if (enabled) {
        provider.cancelPendingRequest();
        await vscode.commands.executeCommand("editor.action.inlineSuggest.hide");
      }
      setStatus(enabled ? "disabled" : "enabled");
    }),
    vscode.commands.registerCommand("reticle.triggerCompletion", async () => {
      await vscode.commands.executeCommand("editor.action.inlineSuggest.trigger");
    }),
    vscode.commands.registerCommand("reticle.openPanel", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.reticle");
    }),
    vscode.commands.registerCommand("reticle.testEndpoint", async () => {
      try {
        const settings = validateSettings(
          readSettings(vscode.workspace.getConfiguration("reticle")),
        );
        logs.appendLine("[probe] Starting Command Palette completion test.");
        const result = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Reticle: testing autocomplete endpoint",
            cancellable: true,
          },
          async (_progress, token) => {
            const controller = new AbortController();
            const cancellation = token.onCancellationRequested(() => controller.abort());
            try {
              return await probeEndpoint(settings, { signal: controller.signal });
            } finally {
              cancellation.dispose();
            }
          },
        );
        logs.appendLine(
          `[probe] ${
            result.classification === "insertion" ? "passed" : `failed (${result.classification})`
          } in ${result.elapsedMs} ms.`,
        );
        await showProbeVerdict(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof SettingsError) {
          await vscode.window
            .showErrorMessage(message, "Open Reticle Settings")
            .then(async (action) => {
              if (action === "Open Reticle Settings") {
                await vscode.commands.executeCommand(
                  "workbench.action.openSettings",
                  "@ext:roboalchemist.reticle",
                );
              }
            });
          return;
        }
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          logs.appendLine(`[probe] ${message}`);
          await vscode.window.showErrorMessage(`Reticle endpoint probe failed: ${message}`);
        }
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("reticle")) {
        provider.cancelPendingRequest();
        panel.configurationChanged();
        if (
          event.affectsConfiguration("reticle.multiFileContext") &&
          !vscode.workspace.getConfiguration("reticle").get<boolean>("multiFileContext", false)
        ) {
          contextEngine.clear();
        }
        if (
          ["baseURL", "model", "apiKey", "extraHeaders", "fimFormat"].some((setting) =>
            event.affectsConfiguration(`reticle.${setting}`),
          )
        ) {
          provider.resetEndpointHealth();
        }
        const enabled = vscode.workspace
          .getConfiguration("reticle")
          .get<boolean>("enableAutoTrigger", true);
        if (!enabled) {
          void vscode.commands.executeCommand("editor.action.inlineSuggest.hide");
        }
        setStatus(enabled ? "enabled" : "disabled");
      }
    }),
  );
  logs.appendLine("[extension] Reticle activated.");

  return {
    provideInlineCompletionItems: (document, position, inlineContext, token) =>
      provider.provideInlineCompletionItems(document, position, inlineContext, token),
  };
}

export function deactivate(): void {
  // VS Code disposes subscriptions registered on the extension context.
}
