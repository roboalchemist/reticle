import { describe, expect, it, vi } from "vitest";

import { ReticleLogStore } from "../src/ui/logStore.js";

describe("Reticle panel log store", () => {
  it("shares bounded timestamped logs with Output and panel listeners", () => {
    const output = {
      appendLine: vi.fn(),
      clear: vi.fn(),
      show: vi.fn(),
    };
    const listener = vi.fn();
    const logs = new ReticleLogStore(output, 2, () => new Date("2026-07-29T19:00:00.000Z"));
    const subscription = logs.onDidChange(listener);

    logs.appendLine("[extension] activated");
    logs.appendLine("[health] healthy");
    logs.appendLine("[probe] passed");

    expect(output.appendLine).toHaveBeenCalledWith("[probe] passed");
    expect(logs.text()).toBe("[19:00:00] [health] healthy\n[19:00:00] [probe] passed");
    expect(listener).toHaveBeenLastCalledWith(logs.text());

    logs.show();
    expect(output.show).toHaveBeenCalledWith(true);
    logs.clear();
    expect(logs.text()).toBe("");
    expect(output.clear).toHaveBeenCalledOnce();
    subscription.dispose();
  });
});
