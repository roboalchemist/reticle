export function panelHtml(cspSource: string, nonce: string, logoUri: string): string {
  return /* html */ `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src ${cspSource}; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';"
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
    .logo { border-radius: 7px; height: 32px; width: 32px; }
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
    label.check {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 7px;
    }
    label.check input { flex: none; margin: 0; width: auto; }
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
    .health-actions { align-items: center; }
    .settings-actions {
      display: grid;
      grid-column: 1 / -1;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 6px;
      margin-top: 4px;
    }
    .settings-actions button { width: 100%; }
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
    .field-note {
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
      line-height: 1.35;
    }
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
    <img class="logo" src="${logoUri}" alt="">
    <div><h1>Reticle</h1><p>Local-first code completion</p></div>
  </div>

  <section class="card stack" aria-labelledby="health-heading">
    <h2 id="health-heading">Endpoint health</h2>
    <div id="endpoint" class="endpoint"></div>
    <div class="actions health-actions">
      <span id="health-badge" class="badge" data-state="checking">Checking…</span>
      <button id="check-health" type="button">Check health</button>
      <button id="trigger-completion" type="button" class="secondary">Try in editor</button>
    </div>
  </section>

  <section class="card" aria-labelledby="settings-heading">
    <div class="row spread">
      <h2 id="settings-heading">Settings</h2>
      <span id="autocomplete-state"></span>
    </div>
    <form id="settings-form" class="grid">
      <label class="wide">Base URL<input id="baseURL" type="url" required></label>
      <label class="wide">Available model
        <input id="model" type="text" list="model-options" autocomplete="off" required>
        <datalist id="model-options"></datalist>
        <span id="model-help" class="field-note">Checking the endpoint for models…</span>
      </label>
      <label>FIM format
        <select id="fimFormat">
          <option value="qwen">Qwen</option>
          <option value="seed">Seed</option>
          <option value="zeta">Zeta 2.1 region FIM</option>
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
      <div class="settings-actions">
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
    let formDirty = false;

    function setBusy(busy) {
      for (const id of ["check-health", "trigger-completion", "save-settings"]) {
        byId(id).disabled = busy;
      }
    }

    function renderModelOptions(modelIds, configuredModel, baseURL) {
      const ids = [];
      const seen = new Set();
      for (const id of [configuredModel, ...(Array.isArray(modelIds) ? modelIds : [])]) {
        if (typeof id !== "string" || id.length === 0 || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
      const fragment = document.createDocumentFragment();
      for (const id of ids) {
        const option = document.createElement("option");
        option.value = id;
        fragment.appendChild(option);
      }
      byId("model-options").replaceChildren(fragment);
      const reportedCount = Array.isArray(modelIds) ? modelIds.length : 0;
      const localEndpoint = /^https?:\\/\\/(127(?:\\.\\d+){3}|localhost|\\[::1\\])(?::|\\/|$)/i.test(baseURL);
      byId("model-help").textContent = reportedCount > 0
        ? reportedCount + (localEndpoint ? " downloaded models reported by the local endpoint. " : " models reported by the endpoint. ") + "Select one or enter another ID; FIM format must match."
        : "No model list reported. Enter a model ID manually; FIM format must match.";
    }

    function render(state) {
      const health = state.health;
      byId("health-badge").dataset.state = health.status;
      byId("health-badge").textContent =
        health.status === "checking" ? "Checking…" : health.message;
      byId("endpoint").textContent = state.settings.baseURL;
      byId("autocomplete-state").textContent = state.autocomplete.message;
      byId("settings-message").textContent = state.notice;
      byId("logs").textContent = state.logs || "No Reticle activity yet.";
      renderModelOptions(state.availableModels, state.settings.model, state.settings.baseURL);
      if (!formDirty) {
        for (const key of ["baseURL", "model", "fimFormat", "temperature", "maxTokens", "maxLines", "debounceMs"]) {
          byId(key).value = String(state.settings[key]);
        }
        byId("enableAutoTrigger").checked = state.settings.enableAutoTrigger;
        byId("multiFileContext").checked = state.settings.multiFileContext;
      }
      setBusy(state.busy);
    }

    window.addEventListener("message", (event) => {
      if (event.data?.type === "state") render(event.data.state);
    });
    byId("check-health").addEventListener("click", () => vscode.postMessage({ type: "checkHealth" }));
    byId("trigger-completion").addEventListener("click", () => vscode.postMessage({ type: "triggerCompletion" }));
    byId("open-settings").addEventListener("click", () => vscode.postMessage({ type: "openSettings" }));
    byId("copy-logs").addEventListener("click", () => vscode.postMessage({ type: "copyLogs" }));
    byId("clear-logs").addEventListener("click", () => vscode.postMessage({ type: "clearLogs" }));
    byId("open-output").addEventListener("click", () => vscode.postMessage({ type: "openOutput" }));
    byId("settings-form").addEventListener("input", () => {
      formDirty = true;
    });
    byId("settings-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const settings = {
        baseURL: byId("baseURL").value,
        model: byId("model").value,
        fimFormat: byId("fimFormat").value,
        temperature: byId("temperature").valueAsNumber,
        maxTokens: byId("maxTokens").valueAsNumber,
        maxLines: byId("maxLines").valueAsNumber,
        debounceMs: byId("debounceMs").valueAsNumber,
        enableAutoTrigger: byId("enableAutoTrigger").checked,
        multiFileContext: byId("multiFileContext").checked
      };
      formDirty = false;
      vscode.postMessage({
        type: "saveSettings",
        settings
      });
    });
    vscode.postMessage({ type: "ready" });
  </script>
</body>
</html>`;
}
