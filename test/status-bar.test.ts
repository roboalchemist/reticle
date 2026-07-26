import { describe, expect, it, vi } from "vitest";

const { createStatusBarItem, item } = vi.hoisted(() => {
  const item = {
    accessibilityInformation: undefined as { label: string } | undefined,
    backgroundColor: undefined as unknown,
    command: undefined as string | undefined,
    dispose: vi.fn(),
    name: "",
    show: vi.fn(),
    text: "",
    tooltip: "" as unknown,
  };
  return { item, createStatusBarItem: vi.fn(() => item) };
});

vi.mock("vscode", () => ({
  window: { createStatusBarItem },
  StatusBarAlignment: { Right: 2 },
  ThemeColor: class ThemeColor {
    constructor(public readonly id: string) {}
  },
}));

import { StatusBarController } from "../src/ui/statusBar.js";

describe("Reticle status bar", () => {
  it("renders enabled, working, error, and disabled states and toggles on click", () => {
    const status = new StatusBarController("enabled");
    expect(createStatusBarItem).toHaveBeenCalledWith("reticle.status", 2, 100);
    expect(item.command).toBe("reticle.toggle");
    expect(item.text).toContain("$(target)");
    expect(item.show).toHaveBeenCalledOnce();

    status.setState("working");
    expect(item.text).toContain("$(sync~spin)");
    status.setState("error", "retrying endpoint in 5s");
    expect(item.text).toContain("$(error)");
    expect(item.tooltip).toContain("retrying endpoint in 5s");
    expect(item.backgroundColor).toEqual(
      expect.objectContaining({ id: "statusBarItem.errorBackground" }),
    );
    status.setState("disabled");
    expect(status.getState()).toBe("disabled");
    expect(item.text).toContain("$(circle-slash)");
    expect(item.backgroundColor).toBeUndefined();
    status.dispose();
    expect(item.dispose).toHaveBeenCalledOnce();
  });
});
