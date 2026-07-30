import { randomBytes } from "node:crypto";

import * as vscode from "vscode";

import { checkEndpointHealth } from "../config/health.js";
import { probeEndpoint } from "../config/probe.js";
import {
  readSettings,
  SettingsError,
  validateSettings,
  type ReticleSettings,
} from "../config/settings.js";
import type { ReticleStatus } from "./statusBar.js";
import { ReticleLogStore } from "./logStore.js";
import { panelHtml } from "./panelHtml.js";
import {
  mergePanelSettings,
  PANEL_SETTING_KEYS,
  panelSettingsFrom,
  type PanelSettings,
} from "./panelModel.js";
import { probeVerdictMessage } from "./warnings.js";

const VIEW_ID = "reticle.panel";
const HEALTH_INTERVAL_MS = 15_000;
const HEALTH_TIMEOUT_MS = 5_000;

type HealthState = "checking" | "healthy" | "unhealthy";
type ProbeState = "idle" | "running" | "passed" | "failed";

interface PanelState {
  autocomplete: { message: string; status: ReticleStatus };
  busy: boolean;
  health: { message: string; status: HealthState };
  logs: string;
  notice: string;
  probe: { message: string; status: ProbeState };
  settings: PanelSettings;
}

type PanelMessage =
  | { type: "checkHealth" }
  | { type: "clearLogs" }
  | { type: "copyLogs" }
  | { type: "openOutput" }
  | { type: "openSettings" }
  | { type: "ready" }
  | { settings: unknown; type: "saveSettings" }
  | { type: "testCompletion" };

function isPanelMessage(value: unknown): value is PanelMessage {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return false;
  }
  const type = (value as { type?: unknown }).type;
  return (
    type === "ready" ||
    type === "checkHealth" ||
    type === "testCompletion" ||
    type === "saveSettings" ||
    type === "openSettings" ||
    type === "copyLogs" ||
    type === "clearLogs" ||
    type === "openOutput"
  );
}

function configurationTarget(
  configuration: vscode.WorkspaceConfiguration,
  key: string,
): vscode.ConfigurationTarget {
  const inspected = configuration.inspect(key);
  if (inspected?.workspaceFolderValue !== undefined) {
    return vscode.ConfigurationTarget.WorkspaceFolder;
  }
  if (inspected?.workspaceValue !== undefined) {
    return vscode.ConfigurationTarget.Workspace;
  }
  return vscode.ConfigurationTarget.Global;
}

export class ReticlePanelProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly viewID = VIEW_ID;

  private autocomplete: PanelState["autocomplete"] = {
    message: "Autocomplete enabled",
    status: "enabled",
  };
  private busy = false;
  private health: PanelState["health"] = {
    message: "Waiting for endpoint check",
    status: "checking",
  };
  private notice = "";
  private probe: PanelState["probe"] = {
    message: "Run the completion test to verify suffix-aware FIM output.",
    status: "idle",
  };
  private view?: vscode.WebviewView;
  private messageSubscription?: vscode.Disposable;
  private visibilitySubscription?: vscode.Disposable;
  private readonly logSubscription: { dispose(): void };
  private readonly healthTimer: ReturnType<typeof setInterval>;

  constructor(private readonly logs: ReticleLogStore) {
    this.logSubscription = logs.onDidChange(() => this.postState());
    this.healthTimer = setInterval(() => {
      if (this.view?.visible && !this.busy) {
        void this.checkHealth(false);
      }
    }, HEALTH_INTERVAL_MS);
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.messageSubscription?.dispose();
    this.visibilitySubscription?.dispose();
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = panelHtml(
      webviewView.webview.cspSource,
      randomBytes(16).toString("hex"),
    );
    this.messageSubscription = webviewView.webview.onDidReceiveMessage((message: unknown) => {
      void this.handleMessage(message);
    });
    this.visibilitySubscription = webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.postState();
        void this.checkHealth(false);
      }
    });
    this.postState();
    void this.checkHealth(false);
  }

  setAutocompleteStatus(status: ReticleStatus, detail?: string): void {
    const label = {
      disabled: "Autocomplete disabled",
      enabled: "Autocomplete enabled",
      error: "Autocomplete error",
      working: "Generating completion",
    }[status];
    this.autocomplete = { message: detail ? `${label}: ${detail}` : label, status };
    this.postState();
  }

  configurationChanged(): void {
    this.notice = "";
    this.postState();
    if (this.view?.visible && !this.busy) {
      void this.checkHealth(false);
    }
  }

  dispose(): void {
    clearInterval(this.healthTimer);
    this.logSubscription.dispose();
    this.messageSubscription?.dispose();
    this.visibilitySubscription?.dispose();
  }

  private configuration(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(
      "reticle",
      vscode.window.activeTextEditor?.document.uri,
    );
  }

  private settings(): ReticleSettings {
    return readSettings(this.configuration());
  }

  private state(): PanelState {
    let settings: PanelSettings;
    try {
      settings = panelSettingsFrom(this.settings());
    } catch {
      const configuration = this.configuration();
      const fimFormat = configuration.get<string>("fimFormat", "openai");
      settings = {
        baseURL: configuration.get<string>("baseURL", "http://127.0.0.1:8001/v1"),
        debounceMs: configuration.get<number>("debounceMs", 100),
        enableAutoTrigger: configuration.get<boolean>("enableAutoTrigger", true),
        fimFormat:
          fimFormat === "codestral" ||
          fimFormat === "qwen" ||
          fimFormat === "seed" ||
          fimFormat === "openai"
            ? fimFormat
            : "openai",
        maxLines: configuration.get<number>("maxLines", 8),
        maxTokens: configuration.get<number>("maxTokens", 256),
        model: configuration.get<string>("model", ""),
        multiFileContext: configuration.get<boolean>("multiFileContext", false),
        temperature: configuration.get<number>("temperature", 0),
      };
    }
    return {
      autocomplete: this.autocomplete,
      busy: this.busy,
      health: this.health,
      logs: this.logs.text(),
      notice: this.notice,
      probe: this.probe,
      settings,
    };
  }

  private postState(): void {
    if (!this.view) {
      return;
    }
    void this.view.webview.postMessage({ state: this.state(), type: "state" });
  }

  private async handleMessage(value: unknown): Promise<void> {
    if (!isPanelMessage(value)) {
      this.logs.appendLine("[panel] Ignored an invalid panel message.");
      return;
    }

    switch (value.type) {
      case "ready":
        this.postState();
        return;
      case "checkHealth":
        await this.checkHealth(true);
        return;
      case "testCompletion":
        await this.testCompletion();
        return;
      case "saveSettings":
        await this.saveSettings(value.settings);
        return;
      case "openSettings":
        await vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "@ext:roboalchemist.reticle",
        );
        return;
      case "copyLogs":
        await vscode.env.clipboard.writeText(this.logs.text());
        this.notice = "Logs copied to the clipboard.";
        this.postState();
        return;
      case "clearLogs":
        this.logs.clear();
        this.notice = "Logs cleared.";
        this.postState();
        return;
      case "openOutput":
        this.logs.show();
        return;
    }
  }

  private async checkHealth(manual: boolean): Promise<void> {
    if (this.busy) {
      return;
    }
    const previousStatus = this.health.status;
    this.busy = true;
    this.health = { message: "Checking the OpenAI-compatible API…", status: "checking" };
    this.notice = "";
    this.postState();
    try {
      const settings = validateSettings(this.settings());
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(new Error(`Health check timed out after ${HEALTH_TIMEOUT_MS} ms.`)),
        HEALTH_TIMEOUT_MS,
      );
      try {
        const result = await checkEndpointHealth(settings, { signal: controller.signal });
        this.health = { message: result.message, status: result.status };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.health = { message, status: "unhealthy" };
    } finally {
      this.busy = false;
      if (manual || previousStatus !== this.health.status) {
        this.logs.appendLine(`[health] ${this.health.status}: ${this.health.message}`);
      }
      this.postState();
    }
  }

  private async testCompletion(): Promise<void> {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.probe = { message: "Running the suffix-dependent FIM probe…", status: "running" };
    this.notice = "";
    this.logs.appendLine("[probe] Starting panel completion test.");
    this.postState();

    try {
      const result = await probeEndpoint(validateSettings(this.settings()));
      const passed = result.classification === "insertion";
      this.probe = {
        message: probeVerdictMessage(result),
        status: passed ? "passed" : "failed",
      };
      this.health = {
        message: passed
          ? `Completion endpoint reachable in ${result.elapsedMs} ms`
          : "Endpoint reachable, but its completion is incompatible",
        status: passed ? "healthy" : "unhealthy",
      };
      this.logs.appendLine(
        `[probe] ${passed ? "passed" : `failed (${result.classification})`} in ${result.elapsedMs} ms.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.probe = { message, status: "failed" };
      this.health = { message, status: "unhealthy" };
      this.logs.appendLine(`[probe] ${message}`);
    } finally {
      this.busy = false;
      this.postState();
    }
  }

  private async saveSettings(value: unknown): Promise<void> {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.notice = "";
    this.postState();

    let saved = false;
    try {
      const configuration = this.configuration();
      const current = this.settings();
      const next = mergePanelSettings(current, value);
      for (const key of PANEL_SETTING_KEYS) {
        if (next[key] !== current[key]) {
          await configuration.update(key, next[key], configurationTarget(configuration, key));
        }
      }
      this.notice = "Settings saved.";
      saved = true;
      this.logs.appendLine("[settings] Saved core Reticle settings from the panel.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.notice =
        error instanceof SettingsError ? message : `Reticle: could not save settings: ${message}`;
      this.logs.appendLine(`[settings] ${this.notice}`);
    } finally {
      this.busy = false;
      this.postState();
    }

    if (saved) {
      await this.checkHealth(false);
    }
  }
}
