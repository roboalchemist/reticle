import { describe, expect, it } from "vitest";

import { buildCompletionsRequest, completionsUrl } from "../src/completion/request.js";

describe("OpenAI-compatible FIM request", () => {
  it("uses the validated raw prompt and suffix shape exactly", () => {
    expect(
      buildCompletionsRequest("function add(a, b) { return ", "; }\n", "qwen-fim", {
        fimFormat: "openai",
        maxTokens: 64,
        temperature: 0,
      }),
    ).toEqual({
      model: "qwen-fim",
      prompt: "function add(a, b) { return ",
      suffix: "; }\n",
      max_tokens: 64,
      temperature: 0,
      stream: true,
    });
  });

  it("embeds Qwen PSM markers for plain-completion servers", () => {
    expect(
      buildCompletionsRequest("const value = ", ";\n", "qwen-fim", {
        fimFormat: "qwen",
        maxTokens: 32,
        temperature: 0,
      }),
    ).toEqual({
      model: "qwen-fim",
      prompt: "<|fim_prefix|>const value = <|fim_suffix|>;\n<|fim_middle|>",
      suffix: "",
      max_tokens: 32,
      temperature: 0,
      stream: true,
    });
  });

  it("normalizes base URLs without duplicating the endpoint", () => {
    expect(completionsUrl("http://127.0.0.1:8001/v1/")).toBe(
      "http://127.0.0.1:8001/v1/completions",
    );
    expect(completionsUrl("https://example.test/v1/completions")).toBe(
      "https://example.test/v1/completions",
    );
  });
});
