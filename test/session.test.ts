import { describe, expect, it } from "vitest";

import {
  SESSION_HEADER,
  buildCompletionHeaders,
  createSessionId,
} from "../src/completion/session.js";

describe("completion session identity", () => {
  it("is stable for a model/document and isolated across either scope", () => {
    const first = createSessionId("model-a", "file:///repo/a.ts");
    expect(first).toBe("e76f43b1a7cfb036b1ddfd6da0ff8890fe0a89a7cffb9fe5dfd29af1ed18e5b4");
    expect(createSessionId("model-a", "file:///repo/a.ts")).toBe(first);
    expect(createSessionId("model-b", "file:///repo/a.ts")).not.toBe(first);
    expect(createSessionId("model-a", "file:///repo/b.ts")).not.toBe(first);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("merges extra headers without allowing session identity replacement", () => {
    expect(
      buildCompletionHeaders(
        "stable",
        {
          "x-provider": "custom",
          "X-Reticle-Autocomplete-Session-Id": "wrong",
          "content-type": "text/plain",
        },
        "key",
      ),
    ).toEqual({
      "x-provider": "custom",
      [SESSION_HEADER]: "stable",
      "Content-Type": "application/json",
      Authorization: "Bearer key",
    });
  });

  it("reserves Authorization case-insensitively when an API key is configured", () => {
    expect(
      buildCompletionHeaders(
        "stable",
        {
          authorization: "Bearer attacker-lowercase",
          AUTHORIZATION: "Bearer attacker-uppercase",
        },
        "trusted-key",
      ),
    ).toEqual({
      [SESSION_HEADER]: "stable",
      "Content-Type": "application/json",
      Authorization: "Bearer trusted-key",
    });
  });
});
