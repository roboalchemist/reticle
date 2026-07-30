export function panelHtml(cspSource: string, nonce: string): string {
  return /* html */ `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';"
  >
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style nonce="${nonce}">
    :root { color-scheme: light dark; }
    body {
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      font: var(--vscode-font-size) var(--vscode-font-family);
      margin: 0;
      padding: 12px;
    }
    h1 { font-size: 18px; margin: 0; }
    h2 { font-size: 12px; margin: 0; text-transform: uppercase; letter-spacing: .06em; }
    p { margin: 6px 0 0; color: var(--vscode-descriptionForeground); }
    .header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .mark { color: var(--vscode-textLink-foreground); font-size: 18px; }
    .card {
      border: 1px solid var(--vscode-widget-border);
      background: var(--vscode-editorWidget-background);
      border-radius: 6px;
      margin-bottom: 12px;
      padding: 12px;
    }
    .row { display: flex; align-items: center; gap: 8px; }
    .spread { justify-content: space-between; }
    .stack { display: grid; gap: 8px; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
    label { display: grid; gap: 4px; color: var(--vscode-descriptionForeground); font-size: 11px; }
    label.wide { grid-column: 1 / -1; }
    label.check { display: flex; align-items: center; gap: 7px; }
    input, select {
      box-sizing: border-box;
      width: 100%;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, transparent);
      padding: 5px 7px;
    }
    input:focus, select:focus {
      border-color: var(--vscode-focusBorder);
      outline: 1px solid var(--vscode-focusBorder);
    }
    button {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border: 0;
      border-radius: 2px;
      cursor: pointer;
      padding: 6px 10px;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
    }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    button:disabled { cursor: default; opacity: .55; }
    .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .badge {
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 7px;
    }
    .badge[data-state="healthy"], .badge[data-state="passed"] {
      color: var(--vscode-testing-iconPassed);
      background: color-mix(in srgb, var(--vscode-testing-iconPassed) 15%, transparent);
    }
    .badge[data-state="unhealthy"], .badge[data-state="failed"] {
      color: var(--vscode-testing-iconFailed);
      background: color-mix(in srgb, var(--vscode-testing-iconFailed) 15%, transparent);
    }
    .badge[data-state="checking"], .badge[data-state="running"] {
      color: var(--vscode-testing-iconQueued);
      background: color-mix(in srgb, var(--vscode-testing-iconQueued) 15%, transparent);
    }
    .endpoint { font-family: var(--vscode-editor-font-family); overflow-wrap: anywhere; }
    .notice { min-height: 18px; margin-top: 8px; }
    pre {
      background: var(--vscode-textCodeBlock-background);
      box-sizing: border-box;
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
      line-height: 1.45;
      margin: 8px 0 0;
      max-height: 260px;
      min-height: 110px;
      overflow: auto;
      padding: 8px;
      resize: vertical;
      user-select: text;
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="mark" aria-hidden="true">&lt;✦&gt;</span>
    <div><h1>Reticle</h1><p>Local-first code completion</p></div>
  </div>

  <section class="card stack" aria-labelledby="health-heading">
    <div class="row spread">
      <h2 id="health-heading">Endpoint health</h2>
      <span id="health-badge" class="badge" data-state="checking">Checking</span>
    </div>
    <div id="endpoint" class="endpoint"></div>
    <div id="health-message"></div>
    <div class="actions">
      <button id="check-health" type="button">Check health</button>
      <button id="test-completion" type="button" class="secondary">Test completion</button>
    </div>
    <div id="probe-result" class="notice" role="status"></div>
  </section>

  <section class="card" aria-labelledby="settings-heading">
    <div class="row spread">
      <h2 id="settings-heading">Settings</h2>
      <span id="autocomplete-state"></span>
    </div>
    <form id="settings-form" class="grid">
      <label class="wide">Base URL<input id="baseURL" type="url" required></label>
      <label class="wide">Model<input id="model" type="text" required></label>
      <label>FIM format
        <select id="fimFormat">
          <option value="qwen">Qwen</option>
          <option value="seed">Seed</option>
          <option value="codestral">Codestral</option>
          <option value="openai">OpenAI prompt + suffix</option>
        </select>
      </label>
      <label>Temperature<input id="temperature" type="number" min="0" max="2" step="0.1"></label>
      <label>Max tokens<input id="maxTokens" type="number" min="1" max="2048" step="1"></label>
      <label>Max lines<input id="maxLines" type="number" min="1" max="64" step="1"></label>
      <label class="wide">Trigger delay (ms)<input id="debounceMs" type="number" min="75" max="150" step="1"></label>
      <label class="check wide"><input id="enableAutoTrigger" type="checkbox"> Automatic suggestions</label>
      <label class="check wide"><input id="multiFileContext" type="checkbox"> Include context from other open files</label>
      <div class="actions wide">
        <button id="save-settings" type="submit">Save settings</button>
        <button id="open-settings" type="button" class="secondary">Open all settings</button>
      </div>
    </form>
    <div id="settings-message" class="notice" role="status"></div>
  </section>

  <section class="card" aria-labelledby="logs-heading">
    <div class="row spread"><h2 id="logs-heading">Logs</h2></div>
    <div class="actions">
      <button id="copy-logs" type="button">Copy</button>
      <button id="clear-logs" type="button" class="secondary">Clear</button>
      <button id="open-output" type="button" class="secondary">Open Output</button>
    </div>
    <pre id="logs" tabindex="0">No Reticle activity yet.</pre>
  </section>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const byId = (id) => document.getElementById(id);
    let currentState;

    function setBusy(busy) {
      for (const id of ["check-health", "test-completion", "save-settings"]) {
        byId(id).disabled = busy;
      }
    }

    function render(state) {
      currentState = state;
      const health = state.health;
      byId("health-badge").dataset.state = health.status;
      byId("health-badge").textContent =
        health.status === "healthy" ? "Healthy" :
        health.status === "unhealthy" ? "Unhealthy" : "Checking";
      byId("endpoint").textContent = state.settings.baseURL;
      byId("health-message").textContent = health.message;
      byId("probe-result").textContent = state.probe.message;
      byId("probe-result").dataset.state = state.probe.status;
      byId("autocomplete-state").textContent = state.autocomplete.message;
      byId("settings-message").textContent = state.notice;
      byId("logs").textContent = state.logs || "No Reticle activity yet.";
      for (const key of ["baseURL", "model", "fimFormat", "temperature", "maxTokens", "maxLines", "debounceMs"]) {
        byId(key).value = String(state.settings[key]);
      }
      byId("enableAutoTrigger").checked = state.settings.enableAutoTrigger;
      byId("multiFileContext").checked = state.settings.multiFileContext;
      setBusy(state.busy);
    }

    window.addEventListener("message", (event) => {
      if (event.data?.type === "state") render(event.data.state);
    });
    byId("check-health").addEventListener("click", () => vscode.postMessage({ type: "checkHealth" }));
    byId("test-completion").addEventListener("click", () => vscode.postMessage({ type: "testCompletion" }));
    byId("open-settings").addEventListener("click", () => vscode.postMessage({ type: "openSettings" }));
    byId("copy-logs").addEventListener("click", () => vscode.postMessage({ type: "copyLogs" }));
    byId("clear-logs").addEventListener("click", () => vscode.postMessage({ type: "clearLogs" }));
    byId("open-output").addEventListener("click", () => vscode.postMessage({ type: "openOutput" }));
    byId("settings-form").addEventListener("submit", (event) => {
      event.preventDefault();
      vscode.postMessage({
        type: "saveSettings",
        settings: {
          baseURL: byId("baseURL").value,
          model: byId("model").value,
          fimFormat: byId("fimFormat").value,
          temperature: byId("temperature").valueAsNumber,
          maxTokens: byId("maxTokens").valueAsNumber,
          maxLines: byId("maxLines").valueAsNumber,
          debounceMs: byId("debounceMs").valueAsNumber,
          enableAutoTrigger: byId("enableAutoTrigger").checked,
          multiFileContext: byId("multiFileContext").checked
        }
      });
    });
    vscode.postMessage({ type: "ready" });
  </script>
</body>
</html>`;
}
