import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  if (process.env.RETICLE_INTEGRATION !== "1") {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.reject(
          new Error(
            "Unexpected network request in the offline test suite. Set RETICLE_INTEGRATION=1 only for the live harness.",
          ),
        ),
      ),
    );
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});
