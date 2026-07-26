import { describe, expect, it } from "vitest";

import { buildCompletionsRequest } from "../src/completion/request.js";
import { parseSseData, streamCompletion } from "../src/completion/stream.js";

const body = buildCompletionsRequest("return ", "\n}", "model", {
  maxTokens: 16,
  temperature: 0,
});

describe("OpenAI completion streaming", () => {
  it("extracts completion text and ignores terminal/malformed events", () => {
    expect(parseSseData('{"choices":[{"text":"a +"}]}')).toBe("a +");
    expect(parseSseData("[DONE]")).toBe("");
    expect(parseSseData("not-json")).toBe("");
    expect(() => parseSseData('{"error":{"message":"model failed"}}')).toThrow("model failed");
  });

  it("treats DONE as terminal instead of accepting later events", async () => {
    const responseBody = [
      'data: {"choices":[{"text":"before"}]}',
      "",
      "data: [DONE]",
      "",
      'data: {"choices":[{"text":"AFTER"}]}',
      "",
    ].join("\n");
    const fetch = () =>
      Promise.resolve(
        new Response(responseBody, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      );

    await expect(
      streamCompletion({
        url: "http://localhost/v1/completions",
        body,
        headers: {},
        signal: new AbortController().signal,
        fetch,
      }),
    ).resolves.toBe("before");
  });

  it("assembles split SSE chunks and stops at a requested boundary", async () => {
    const encoder = new TextEncoder();
    const responseBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"text":"display"}]}\n'));
        controller.enqueue(encoder.encode('\ndata: {"choices":[{"text":"Name "}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"text":"ignored"}]}\n\n'));
        controller.close();
      },
    });
    const fetch = () =>
      Promise.resolve(
        new Response(responseBody, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      );

    await expect(
      streamCompletion({
        url: "http://localhost/v1/completions",
        body,
        headers: {},
        signal: new AbortController().signal,
        fetch,
        shouldStop: (value) => value.includes(" "),
      }),
    ).resolves.toBe("displayName ");
  });

  it("forwards abort signals to fetch", async () => {
    const controller = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    const fetch = (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      receivedSignal = init?.signal ?? undefined;
      return Promise.resolve(
        new Response('{"choices":[{"text":"ok"}]}', {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    };

    await streamCompletion({
      url: "http://localhost/v1/completions",
      body,
      headers: {},
      signal: controller.signal,
      fetch,
    });
    expect(receivedSignal).toBe(controller.signal);
  });

  it("never includes a reflected secret from an HTTP error body", async () => {
    const fetch = () =>
      Promise.resolve(
        new Response("debug: Authorization: Bearer TOP-SECRET-API-KEY", {
          status: 401,
          statusText: "Unauthorized",
        }),
      );

    await expect(
      streamCompletion({
        url: "https://example.test/v1/completions",
        body,
        headers: { Authorization: "Bearer TOP-SECRET-API-KEY" },
        signal: new AbortController().signal,
        fetch,
      }),
    ).rejects.toThrow("Autocomplete endpoint returned 401 Unauthorized.");
    await expect(
      streamCompletion({
        url: "https://example.test/v1/completions",
        body,
        headers: { Authorization: "Bearer TOP-SECRET-API-KEY" },
        signal: new AbortController().signal,
        fetch,
      }),
    ).rejects.not.toThrow("TOP-SECRET-API-KEY");
  });
});
