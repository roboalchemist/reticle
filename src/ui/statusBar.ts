import * as vscode from "vscode";

export type ReticleStatus = "enabled" | "disabled" | "working" | "error";

const STATUS_PRESENTATION: Record<
  ReticleStatus,
  { text: string; tooltip: string; accessibility: string }
> = {
  enabled: {
    text: "$(target) Reticle",
    tooltip: "Reticle autocomplete is enabled",
    accessibility: "Reticle autocomplete enabled",
  },
  disabled: {
    text: "$(circle-slash) Reticle",
    tooltip: "Reticle autocomplete is disabled",
    accessibility: "Reticle autocomplete disabled",
  },
  working: {
    text: "$(sync~spin) Reticle",
    tooltip: "Reticle is generating an inline completion",
    accessibility: "Reticle generating completion",
  },
  error: {
    text: "$(error) Reticle",
    tooltip: "Reticle autocomplete encountered an error",
    accessibility: "Reticle autocomplete error",
  },
};

export class StatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private state: ReticleStatus | undefined;

  constructor(initialState: ReticleStatus = "enabled") {
    this.item = vscode.window.createStatusBarItem(
      "reticle.status",
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.item.name = "Reticle Autocomplete";
    this.item.command = "reticle.toggle";
    this.setState(initialState);
    this.item.show();
  }

  setState(state: ReticleStatus, detail?: string): void {
    this.state = state;
    const presentation = STATUS_PRESENTATION[state];
    this.item.text = presentation.text;
    this.item.tooltip = detail ? `${presentation.tooltip}: ${detail}` : presentation.tooltip;
    this.item.accessibilityInformation = {
      label: detail ? `${presentation.accessibility}: ${detail}` : presentation.accessibility,
    };
    this.item.backgroundColor =
      state === "error" ? new vscode.ThemeColor("statusBarItem.errorBackground") : undefined;
  }

  getState(): ReticleStatus | undefined {
    return this.state;
  }

  dispose(): void {
    this.item.dispose();
  }
}
