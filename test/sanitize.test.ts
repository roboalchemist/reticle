import { describe, expect, it } from "vitest";

import {
  reachedGuardedInlineBoundary,
  reachedInlineBoundary,
  sanitizeCompletion,
} from "../src/completion/sanitize.js";

describe("inline completion sanitizer", () => {
  it("retains only an identifier continuation at its first boundary", () => {
    const context = { languageId: "typescript", prefix: "return user.display" };
    expect(sanitizeCompletion("Name || user.email", context)).toBe("Name");
    expect(reachedInlineBoundary("Name ", context)).toBe(true);
  });

  it("trims CJK and accented-Latin identifier continuations", () => {
    expect(
      sanitizeCompletion("量名 || extra.stuff()", {
        languageId: "javascript",
        prefix: "const 变量",
      }),
    ).toBe("量名");
    expect(
      sanitizeCompletion("féValue + extra", {
        languageId: "typescript",
        prefix: "const café",
      }),
    ).toBe("féValue");
  });

  it("does not truncate general expressions after whitespace", () => {
    const context = { languageId: "javascript", prefix: "  return " };
    expect(sanitizeCompletion("a + b\nmore", context)).toBe("a + b");
    expect(sanitizeCompletion(" a + b;", { ...context, suffix: ";\n}" })).toBe("a + b");
  });

  it("strips Markdown fences and FIM control tokens", () => {
    expect(
      sanitizeCompletion("```js\na + b\n```", { languageId: "javascript", prefix: "return " }),
    ).toBe("a + b");
    expect(
      sanitizeCompletion("value<|fim_middle|> extra", {
        languageId: "typescript",
        prefix: "const va",
      }),
    ).toBe("value");
    expect(sanitizeCompletion("```", { languageId: "python", prefix: "return " })).toBe("");
  });

  it("uses language-specific identifier characters", () => {
    expect(sanitizeCompletion("name$value", { languageId: "python", prefix: "user_" })).toBe(
      "name",
    );
    expect(sanitizeCompletion("name$value", { languageId: "typescript", prefix: "user_" })).toBe(
      "name$value",
    );
  });

  it("keeps enough newline lookahead to detect a trailing fence", () => {
    const context = { languageId: "javascript", prefix: "return " };
    expect(reachedGuardedInlineBoundary("a + b\n", context)).toBe(false);
    expect(reachedGuardedInlineBoundary("a + b\n\n```", context)).toBe(true);
  });
});
