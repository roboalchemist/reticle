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
    const context = { languageId: "javascript", maxLines: 2, prefix: "  return " };
    expect(sanitizeCompletion("a + b\nmore\nignored", context)).toBe("a + b\nmore");
    expect(sanitizeCompletion(" a + b;", { ...context, suffix: ";\n}" })).toBe("a + b");
  });

  it("stops at the existing suffix even when a server ignores stop sequences", () => {
    const context = {
      languageId: "typescript",
      prefix: "const value = user.",
      suffix: ";\nreturn value;",
    };
    const repeated =
      "suffixOnlyIdentifier;\nconst value2 = user.suffixOnlyIdentifier;\nconst value3 =";

    expect(reachedInlineBoundary(repeated, context)).toBe(true);
    expect(sanitizeCompletion(repeated, context)).toBe("suffixOnlyIdentifier");
  });

  it("does not mistake a nested closing delimiter for a one-character suffix", () => {
    expect(
      sanitizeCompletion("if (ready) {\n  run();\n}\n}", {
        languageId: "typescript",
        maxLines: 8,
        prefix: "function start() {\n  ",
        suffix: "}\n",
      }),
    ).toBe("if (ready) {\n  run();\n}\n");
  });

  it("preserves indentation, normalizes newlines, and removes multi-line suffix overlap", () => {
    const context = {
      languageId: "typescript",
      maxLines: 8,
      prefix: "function greet() {\n  ",
      suffix: "\n}\n",
    };
    expect(sanitizeCompletion("const name = getName();\r\n  return name;\r\n}\r\n", context)).toBe(
      "const name = getName();\n  return name;",
    );
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

  it("stops at the configured line budget or a trailing fence", () => {
    const context = { languageId: "javascript", maxLines: 2, prefix: "return " };
    expect(reachedGuardedInlineBoundary("a + b\nnext", context)).toBe(false);
    expect(reachedGuardedInlineBoundary("a + b\nnext\n", context)).toBe(true);
    expect(reachedGuardedInlineBoundary("a + b\n```", context)).toBe(true);
  });
});
