import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CompletionDebouncer,
  MAX_DEBOUNCE_MS,
  MIN_DEBOUNCE_MS,
  clampDebounceMs,
} from "../src/completion/debounce.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("completion debounce", () => {
  it("clamps configuration to the latency budget", () => {
    expect(clampDebounceMs(1)).toBe(MIN_DEBOUNCE_MS);
    expect(clampDebounceMs(100)).toBe(100);
    expect(clampDebounceMs(1_000)).toBe(MAX_DEBOUNCE_MS);
  });

  it("settles an older wait as cancelled when a new edit arrives", async () => {
    vi.useFakeTimers();
    const debouncer = new CompletionDebouncer();
    const stale = debouncer.wait(100);
    const current = debouncer.wait(100);

    await expect(stale).resolves.toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    await expect(current).resolves.toBe(true);
  });
});
