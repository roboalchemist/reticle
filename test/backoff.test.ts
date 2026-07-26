import { describe, expect, it } from "vitest";

import { ErrorBackoff } from "../src/completion/backoff.js";

describe("endpoint error backoff", () => {
  it("backs off after repeated failures, grows, caps, and resets on success", () => {
    const backoff = new ErrorBackoff(3, 100, 250);
    expect(backoff.recordFailure(1).retryAt).toBe(0);
    expect(backoff.recordFailure(2).retryAt).toBe(0);
    expect(backoff.recordFailure(10).retryAt).toBe(110);
    expect(backoff.canRequest(109)).toBe(false);
    expect(backoff.retryInMs(60)).toBe(50);
    expect(backoff.recordFailure(110).retryAt).toBe(310);
    expect(backoff.recordFailure(310).retryAt).toBe(560);
    backoff.recordSuccess();
    expect(backoff.snapshot()).toEqual({ consecutiveFailures: 0, retryAt: 0 });
    expect(backoff.canRequest(0)).toBe(true);
  });
});
