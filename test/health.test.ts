import { describe, expect, it, vi } from "vitest";

import { checkEndpointHealth, modelIdsFromResponse, modelsUrl } from "../src/config/health.js";
import type { ReticleSettings } from "../src/config/settings.js";

const settings: ReticleSettings = {
  apiKey: "secret",
  baseURL: "https://models.example.com/v1",
  debounceMs: 100,
  enableAutoTrigger: true,
  extraHeaders: { "X-Workspace": "local" },
  fimFormat: "qwen",
  languageAllowlist: [],
  languageDenylist: [],
  maxLines: 8,
  maxTokens: 64,
  model: "fim-model",
  multiFileContext: false,
  temperature: 0,
};

describe("endpoint health", () => {
  it("normalizes OpenAI-compatible base and completion URLs", () => {
    expect(modelsUrl("http://127.0.0.1:8001/v1")).toBe("http://127.0.0.1:8001/v1/models");
    expect(modelsUrl("https://models.example.com/v1/completions/")).toBe(
      "https://models.example.com/v1/models",
    );
    expect(modelsUrl("https://models.example.com/v1/models")).toBe(
      "https://models.example.com/v1/models",
    );
  });

  it("checks the models endpoint with configured authentication and headers", async () => {
    const fetch = vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(init?.method).toBe("GET");
      expect(headers.get("authorization")).toBe("Bearer secret");
      expect(headers.get("x-workspace")).toBe("local");
      return Promise.resolve(
        new Response('{"data":[{"id":"zeta/model"},{"id":"seed/model"},{"id":"zeta/model"}]}', {
          status: 200,
        }),
      );
    });

    const result = await checkEndpointHealth(settings, { fetch });

    expect(fetch).toHaveBeenCalledWith(
      "https://models.example.com/v1/models",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result).toMatchObject({
      modelIds: ["seed/model", "zeta/model"],
      status: "healthy",
    });
    expect(result.message).toMatch(/^Reachable in \d+ ms$/);
  });

  it("extracts only bounded, unique string model IDs", () => {
    expect(
      modelIdsFromResponse({
        data: [
          { id: " zeta/model " },
          { id: "seed/model" },
          { id: "zeta/model" },
          { id: "" },
          { id: 42 },
          null,
        ],
      }),
    ).toEqual(["seed/model", "zeta/model"]);
    expect(modelIdsFromResponse({ data: "not-an-array" })).toEqual([]);
    expect(modelIdsFromResponse(null)).toEqual([]);
  });

  it("keeps a successful non-JSON endpoint healthy without model suggestions", async () => {
    await expect(
      checkEndpointHealth(settings, {
        fetch: () => Promise.resolve(new Response("ok", { status: 200 })),
      }),
    ).resolves.toMatchObject({
      modelIds: [],
      status: "healthy",
    });
  });

  it("reports HTTP and network failures as unhealthy", async () => {
    await expect(
      checkEndpointHealth(settings, {
        fetch: () => Promise.resolve(new Response("", { status: 401, statusText: "Unauthorized" })),
      }),
    ).resolves.toMatchObject({
      message: "HTTP 401 Unauthorized",
      modelIds: [],
      status: "unhealthy",
    });

    await expect(
      checkEndpointHealth(settings, {
        fetch: () => Promise.reject(new Error("connection refused")),
      }),
    ).resolves.toMatchObject({
      message: "connection refused",
      modelIds: [],
      status: "unhealthy",
    });
  });
});
