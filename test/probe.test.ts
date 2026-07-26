import { describe, expect, it } from "vitest";

import {
  PROBE_PREFIX,
  PROBE_SUFFIX,
  classifyProbeResponse,
  probeEndpoint,
} from "../src/config/probe.js";
import type { ReticleSettings } from "../src/config/settings.js";

const settings: ReticleSettings = {
  apiKey: "",
  baseURL: "http://127.0.0.1:8001/v1",
  debounceMs: 100,
  enableAutoTrigger: true,
  extraHeaders: {},
  languageAllowlist: [],
  languageDenylist: [],
  maxTokens: 256,
  model: "fim-model",
  multiFileContext: false,
  temperature: 0,
};

describe("FIM endpoint probe", () => {
  it("classifies insertion, prose, fenced, empty, and unexpected responses", () => {
    expect(classifyProbeResponse(" a + b;\n")).toBe("insertion");
    expect(classifyProbeResponse("Here's the corrected version of the function.")).toBe("prose");
    expect(
      classifyProbeResponse(
        "It looks like your function definition is incomplete. Here's the corrected version:",
      ),
    ).toBe("prose");
    expect(classifyProbeResponse("You're close, but that formula is incorrect.")).toBe("prose");
    expect(classifyProbeResponse("```javascript\na + b\n```")).toBe("fenced");
    expect(classifyProbeResponse("a + b\n~~~javascript\nfull rewrite\n~~~")).toBe("fenced");
    expect(classifyProbeResponse("a + b\nExplanation: this adds the numbers.")).toBe("prose");
    expect(classifyProbeResponse("a + b\nanything else")).toBe("unexpected");
    expect(classifyProbeResponse("a + b\nconst unrelated = true")).toBe("unexpected");
    expect(classifyProbeResponse("a + b;\n// trailing output")).toBe("unexpected");
    expect(classifyProbeResponse("  ")).toBe("empty");
    expect(classifyProbeResponse("a - b")).toBe("unexpected");
  });

  it("sends the litmus prefix and suffix using the completion transport", async () => {
    let request: Record<string, unknown> | undefined;
    let headers: Headers | undefined;
    const fetch = (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      if (typeof init?.body !== "string") {
        throw new TypeError("Expected a JSON string request body");
      }
      request = JSON.parse(init.body) as Record<string, unknown>;
      headers = new Headers(init?.headers);
      return Promise.resolve(
        new Response('{"choices":[{"text":"a + b"}]}', {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    };

    const result = await probeEndpoint(settings, { fetch });
    expect(result.classification).toBe("insertion");
    expect(request).toEqual({
      model: "fim-model",
      prompt: PROBE_PREFIX,
      suffix: PROBE_SUFFIX,
      max_tokens: 64,
      temperature: 0,
      stream: true,
    });
    expect(headers?.get("x-reticle-autocomplete-session-id")).toMatch(/^[a-f0-9]{64}$/);
  });
});
