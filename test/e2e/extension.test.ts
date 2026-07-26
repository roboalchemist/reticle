import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

import * as vscode from "vscode";

const extensionId = "roboalchemist.reticle";
const setting = "enableAutoTrigger";
const expectedSettingIds = [
  "reticle.apiKey",
  "reticle.baseURL",
  "reticle.debounceMs",
  "reticle.enableAutoTrigger",
  "reticle.extraHeaders",
  "reticle.languageAllowlist",
  "reticle.languageDenylist",
  "reticle.maxTokens",
  "reticle.model",
  "reticle.multiFileContext",
  "reticle.temperature",
] as const;

interface ExtensionManifest {
  contributes?: {
    configuration?: {
      properties?: Record<string, { default?: unknown; scope?: string }>;
    };
  };
}

let resource: vscode.Uri;
let fixtureSnapshots: Array<{ path: string; contents: Buffer }>;

function configuration(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration("reticle", resource);
}

async function clearToggleOverrides(): Promise<void> {
  const current = configuration();
  await current.update(setting, undefined, vscode.ConfigurationTarget.WorkspaceFolder);
  await current.update(setting, undefined, vscode.ConfigurationTarget.Workspace);
  await current.update(setting, undefined, vscode.ConfigurationTarget.Global);
}

function toggleValues(): {
  global: boolean | undefined;
  workspace: boolean | undefined;
  folder: boolean | undefined;
  effective: boolean;
} {
  const current = configuration();
  const inspected = current.inspect<boolean>(setting);
  assert.ok(inspected, `${setting} must be registered`);
  return {
    global: inspected.globalValue,
    workspace: inspected.workspaceValue,
    folder: inspected.workspaceFolderValue,
    effective: current.get<boolean>(setting, true),
  };
}

suite("Reticle extension host", () => {
  suiteSetup(async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, "the E2E fixture workspace must be open");
    resource = vscode.Uri.joinPath(folder.uri, "sample.ts");
    const workspaceFile = vscode.workspace.workspaceFile;
    assert.ok(workspaceFile, "the E2E fixture must be opened as a multi-root workspace");
    const snapshotPaths = [
      workspaceFile.fsPath,
      vscode.Uri.joinPath(folder.uri, ".vscode", "settings.json").fsPath,
    ];
    fixtureSnapshots = await Promise.all(
      snapshotPaths.map(async (path) => ({ path, contents: await readFile(path) })),
    );
    const document = await vscode.workspace.openTextDocument(resource);
    await vscode.window.showTextDocument(document);
  });

  setup(clearToggleOverrides);
  teardown(clearToggleOverrides);

  suiteTeardown(async () => {
    try {
      await clearToggleOverrides();
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    } finally {
      await Promise.all(fixtureSnapshots.map(({ path, contents }) => writeFile(path, contents)));
    }
  });

  test("activates cleanly and registers the complete settings surface", async () => {
    const extension = vscode.extensions.getExtension(extensionId);
    assert.ok(extension, `${extensionId} must be loaded in the Extension Development Host`);

    await extension.activate();
    assert.equal(extension.isActive, true);

    const manifest = extension.packageJSON as ExtensionManifest;
    const properties = manifest.contributes?.configuration?.properties;
    assert.ok(properties, "Reticle configuration contributions must be present");
    assert.deepEqual(Object.keys(properties).sort(), [...expectedSettingIds].sort());
    assert.equal(properties["reticle.enableAutoTrigger"]?.default, true);
    assert.equal(properties["reticle.enableAutoTrigger"]?.scope, "resource");

    const registered = configuration();
    for (const id of expectedSettingIds) {
      assert.equal(registered.has(id.slice("reticle.".length)), true, `${id} must be registered`);
    }
  });

  test("toggles globally and completes the disable path with an active editor", async () => {
    assert.equal(vscode.window.activeTextEditor?.document.uri.toString(), resource.toString());
    assert.deepEqual(toggleValues(), {
      global: undefined,
      workspace: undefined,
      folder: undefined,
      effective: true,
    });

    await vscode.commands.executeCommand("reticle.toggle");

    assert.deepEqual(toggleValues(), {
      global: false,
      workspace: undefined,
      folder: undefined,
      effective: false,
    });
  });

  test("toggles only an existing workspace value", async () => {
    await configuration().update(setting, true, vscode.ConfigurationTarget.Global);
    await configuration().update(setting, true, vscode.ConfigurationTarget.Workspace);

    await vscode.commands.executeCommand("reticle.toggle");

    assert.deepEqual(toggleValues(), {
      global: true,
      workspace: false,
      folder: undefined,
      effective: false,
    });
  });

  test("toggles only an existing workspace-folder value", async () => {
    await configuration().update(setting, true, vscode.ConfigurationTarget.Global);
    await configuration().update(setting, false, vscode.ConfigurationTarget.Workspace);
    await configuration().update(setting, true, vscode.ConfigurationTarget.WorkspaceFolder);

    await vscode.commands.executeCommand("reticle.toggle");

    assert.deepEqual(toggleValues(), {
      global: true,
      workspace: false,
      folder: false,
      effective: false,
    });
  });
});
