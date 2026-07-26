import { describe, expect, it } from "vitest";

import {
  ContextEngine,
  prependContext,
  type ContextDocument,
} from "../src/context/ContextEngine.js";

function document(path: string, text: string, languageId = "typescript"): ContextDocument {
  return {
    languageId,
    uri: { path, toString: () => `file://${path}` },
    getText: () => text,
  };
}

describe("multi-file context engine", () => {
  it("finds a helper signature in another open file and excludes the current document", () => {
    const current = document("/repo/main.ts", "const result = formatWidget(widget)");
    const helper = document(
      "/repo/helpers.ts",
      "export function formatWidget(widget: Widget): string {\n  return widget.name;\n}",
    );
    const engine = new ContextEngine({ getOpenDocuments: () => [current, helper] });

    const context = engine.buildContext(current, current.getText());

    expect(context).toContain("[Reticle context: helpers.ts]");
    expect(context).toContain("function formatWidget");
    expect(context).not.toContain("[Reticle context: main.ts]");
    expect(context.split("\n").every((line) => line.startsWith("//"))).toBe(true);
  });

  it("ranks same-language and recently edited documents first", () => {
    const current = document("/repo/main.ts", "sharedIdentifier()");
    const python = document("/repo/new.py", "def sharedIdentifier(): pass", "python");
    const typescript = document("/repo/old.ts", "function sharedIdentifier() {}", "typescript");
    const engine = new ContextEngine({ getOpenDocuments: () => [python, typescript] });
    engine.recordEdit(python);

    const context = engine.buildContext(current, current.getText());
    expect(context.indexOf("old.ts")).toBeLessThan(context.indexOf("new.py"));
  });

  it("honors both context and final prompt budgets while preserving cursor-adjacent code", () => {
    const current = document("/repo/main.py", "x".repeat(100));
    const helper = document("/repo/helper.py", "y".repeat(1_000));
    const engine = new ContextEngine({
      getOpenDocuments: () => [helper],
      maxContextCharacters: 120,
      maxSnippetCharacters: 1_000,
    });
    const context = engine.buildContext(current, current.getText());
    const combined = prependContext(current.getText(), context, 160);

    expect(context.length).toBeLessThanOrEqual(120);
    expect(combined.length).toBeLessThanOrEqual(160);
    expect(combined.endsWith("x".repeat(38))).toBe(true);
  });

  it("leaves the local prefix byte-for-byte unchanged when context is empty", () => {
    expect(prependContext("const value = ", "", 16_000)).toBe("const value = ");
  });

  it("uses valid block comments for markup context", () => {
    const current = document("/repo/index.html", "<main>", "html");
    const helper = document("/repo/card.html", "<article>Card</article>", "html");
    const engine = new ContextEngine({ getOpenDocuments: () => [helper] });

    expect(engine.buildContext(current, current.getText())).toMatch(/^<!--\n.*\n-->$/su);
  });

  it("keeps a truncated block comment closed at the hard budget", () => {
    const current = document("/repo/index.html", "<main>", "html");
    const helper = document("/repo/card.html", "x".repeat(1_000), "html");
    const engine = new ContextEngine({
      getOpenDocuments: () => [helper],
      maxContextCharacters: 100,
      maxSnippetCharacters: 1_000,
    });

    const context = engine.buildContext(current, current.getText());
    expect(context.length).toBeLessThanOrEqual(100);
    expect(context.endsWith("\n-->")).toBe(true);
  });

  it("retains a bounded snapshot after a recently edited file closes", () => {
    const current = document("/repo/main.ts", "formatWidget(widget)");
    const helper = document("/repo/helper.ts", "function formatWidget(widget: Widget) {}");
    let open: readonly ContextDocument[] = [helper];
    const engine = new ContextEngine({ getOpenDocuments: () => open });
    engine.recordEdit(helper);
    open = [];

    expect(engine.buildContext(current, current.getText())).toContain("formatWidget");
  });

  it("excludes virtual and cross-workspace documents", () => {
    const current = document("/repo/main.ts", "secretHelper()");
    const virtual: ContextDocument = {
      languageId: "typescript",
      uri: { scheme: "vscode-userdata", toString: () => "vscode-userdata:/settings.json" },
      getText: () => "secretHelper from settings",
    };
    const other = document("/other/helper.ts", "function secretHelper() {}");
    const engine = new ContextEngine({
      getOpenDocuments: () => [virtual, other],
      getWorkspaceKey: (candidate) =>
        candidate.uri.toString().includes("/repo/") ? "repo" : "other",
    });

    expect(engine.buildContext(current, current.getText())).toBe("");
  });

  it("keeps recency bounded so repeated edits cannot outweigh relevance", () => {
    const current = document("/repo/main.ts", "importantHelper()");
    const relevant = document("/repo/relevant.ts", "function importantHelper() {}");
    const noisy = document("/repo/noisy.py", "unrelated = true", "python");
    const engine = new ContextEngine({ getOpenDocuments: () => [noisy, relevant] });
    for (let edit = 0; edit < 2_000; edit += 1) {
      engine.recordEdit(noisy);
    }

    const context = engine.buildContext(current, current.getText());
    expect(context.indexOf("relevant.ts")).toBeLessThan(context.indexOf("noisy.py"));
  });

  it("does no document work while the feature is disabled", () => {
    const getText = () => {
      throw new Error("disabled context must not read documents");
    };
    const current: ContextDocument = {
      languageId: "typescript",
      uri: { toString: () => "file:///repo/main.ts" },
      getText,
    };
    const engine = new ContextEngine({
      getOpenDocuments: () => [current],
      isEnabled: () => false,
    });

    engine.recordEdit(current);
    expect(engine.buildContext(current, "local prefix")).toBe("");
  });

  it("returns no cross-file context when the current document has no workspace", () => {
    const current = document("/outside/main.ts", "helper()");
    const helper = document("/repo/helper.ts", "function helper() {}");
    const engine = new ContextEngine({
      getOpenDocuments: () => [helper],
      getWorkspaceKey: (candidate) =>
        candidate.uri.toString().includes("/repo/") ? "repo" : undefined,
    });

    expect(engine.buildContext(current, current.getText())).toBe("");
  });
});
