import { describe, expect, it } from "vitest";

import {
  ZETA_CURSOR,
  ZETA_REGION_END,
  ZETA_REGION_START,
  buildZetaPrompt,
  reachedZetaBoundary,
  sanitizeZetaCompletion,
  zetaCursorInsertion,
  zetaEditableRegion,
} from "../src/completion/zeta.js";

describe("Zeta 2.1 cursor-local FIM adapter", () => {
  const prefix = "function select(user: User) {\n  const value = user.";
  const suffix = ";\n  return value;\n}\ninterface User { suffixOnlyIdentifier: string }\n";

  it("marks the current line as the editable region", () => {
    const region = zetaEditableRegion(prefix, suffix);
    expect(region).toEqual({
      beforeCursor: "  const value = user.",
      afterCursor: ";",
      beforeRegion: "function select(user: User) {\n",
      afterRegion: "\n  return value;\n}\ninterface User { suffixOnlyIdentifier: string }\n",
      original: "  const value = user.;",
    });
    expect(buildZetaPrompt(prefix, suffix, "src/probe.ts")).toBe(
      "<[fim-suffix]>\n  return value;\n}\ninterface User { suffixOnlyIdentifier: string }\n" +
        "<[fim-prefix]><filename>src/probe.ts\nfunction select(user: User) {\n" +
        `${ZETA_REGION_START}  const value = user.${ZETA_CURSOR};${ZETA_REGION_END}` +
        "<[fim-middle]>",
    );
  });

  it("extracts the rewrite and removes copied outer suffix", () => {
    const region = zetaEditableRegion(prefix, suffix);
    const raw =
      `${ZETA_REGION_START}  const value = user.suffixOnlyIdentifier;` +
      "\n  return value;\n}\n" +
      ZETA_REGION_END;

    const rewrite = sanitizeZetaCompletion(raw, region);
    expect(rewrite).toBe("  const value = user.suffixOnlyIdentifier;");
    expect(zetaCursorInsertion(rewrite, region)).toBe("suffixOnlyIdentifier");
    expect(reachedZetaBoundary(raw)).toBe(true);
  });

  it("rejects incomplete, nested, and unchanged rewrites", () => {
    const region = zetaEditableRegion(prefix, suffix);
    expect(sanitizeZetaCompletion(`${ZETA_REGION_START}${ZETA_REGION_START}`, region)).toBe("");
    expect(
      sanitizeZetaCompletion(`${ZETA_REGION_START}${region.original}${ZETA_REGION_END}`, region),
    ).toBe("");
    expect(
      sanitizeZetaCompletion(`${ZETA_REGION_START}rewrite<|marker_3|>${ZETA_REGION_END}`, region),
    ).toBe("");
  });
});
