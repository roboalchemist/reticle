import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("MTPLX service helper", () => {
  it("uses the installed command name and documents bounded-memory options", () => {
    const directory = mkdtempSync(join(tmpdir(), "reticle-mtplx-"));
    temporaryDirectories.push(directory);
    const installedCommand = join(directory, "reticle-mtplx");
    symlinkSync(join(process.cwd(), "scripts", "mtplx-service"), installedCommand);

    const result = spawnSync(installedCommand, ["--help"], { encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Usage: reticle-mtplx COMMAND");
    expect(result.stdout).toContain("MTPLX_CONTEXT_WINDOW");
    expect(result.stdout).toContain("MTPLX_KV_QUANTIZATION");
    expect(result.stdout).toContain("doctor");
  });

  it("rejects unsafe context and KV settings before any external work", () => {
    const command = join(process.cwd(), "scripts", "mtplx-service");
    const smallContext = spawnSync(command, ["--help"], {
      encoding: "utf8",
      env: { ...process.env, MTPLX_CONTEXT_WINDOW: "1024" },
    });
    const invalidKv = spawnSync(command, ["--help"], {
      encoding: "utf8",
      env: { ...process.env, MTPLX_KV_QUANTIZATION: "q2" },
    });

    expect(smallContext.status).toBe(1);
    expect(smallContext.stderr).toContain("at least 4096");
    expect(invalidKv.status).toBe(1);
    expect(invalidKv.stderr).toContain("must be off, q8, or q4");
  });
});
