import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

function writeExecutable(path: string, body: string): void {
  writeFileSync(path, body);
  chmodSync(path, 0o755);
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Seed MLX service helper", () => {
  it("uses the installed command name and documents cache controls", () => {
    const directory = mkdtempSync(join(tmpdir(), "reticle-seed-mlx-"));
    temporaryDirectories.push(directory);
    const installedCommand = join(directory, "reticle-seed-mlx");
    symlinkSync(join(process.cwd(), "scripts", "seed-mlx-service"), installedCommand);

    const result = spawnSync(installedCommand, ["--help"], { encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Usage: reticle-seed-mlx COMMAND");
    expect(result.stdout).toContain("RETICLE_SEED_PROMPT_CACHE_SIZE");
    expect(result.stdout).toContain("RETICLE_SEED_PROMPT_CACHE_BYTES");
    expect(result.stdout).toContain("RETICLE_SEED_MLX_VERSION");
    expect(result.stdout).toContain("doctor");
    expect(result.stdout).toContain("monitor");
  });

  it("rejects invalid port and prompt cache settings before external work", () => {
    const command = join(process.cwd(), "scripts", "seed-mlx-service");
    const invalidPort = spawnSync(command, ["--help"], {
      encoding: "utf8",
      env: { ...process.env, RETICLE_SEED_PORT: "70000" },
    });
    const invalidCache = spawnSync(command, ["--help"], {
      encoding: "utf8",
      env: { ...process.env, RETICLE_SEED_PROMPT_CACHE_SIZE: "0" },
    });

    expect(invalidPort.status).toBe(1);
    expect(invalidPort.stderr).toContain("must be at most 65535");
    expect(invalidCache.status).toBe(1);
    expect(invalidCache.stderr).toContain("must be a positive integer");
  });

  it("diagnoses the installed service and verifies Seed FIM behavior", () => {
    const home = mkdtempSync(join(tmpdir(), "reticle-seed-mlx-home-"));
    temporaryDirectories.push(home);
    const bin = join(home, "bin");
    const venvBin = join(home, ".reticle", "seed-mlx", "venv", "bin");
    const launchAgents = join(home, "Library", "LaunchAgents");
    mkdirSync(bin, { recursive: true });
    mkdirSync(venvBin, { recursive: true });
    mkdirSync(launchAgents, { recursive: true });

    writeExecutable(join(venvBin, "mlx_lm.server"), "#!/bin/sh\nexit 0\n");
    writeExecutable(join(venvBin, "python"), "#!/bin/sh\nprintf '%s\\n' '0.31.1 0.30.5'\n");
    writeExecutable(join(bin, "launchctl"), "#!/bin/sh\nexit 0\n");
    writeExecutable(
      join(bin, "plutil"),
      `#!/bin/sh
case "$2" in
  ProgramArguments) printf '%s\\n' 15 ;;
  ProgramArguments.0) printf '%s\\n' '${join(venvBin, "mlx_lm.server")}' ;;
  ProgramArguments.1) printf '%s\\n' --model ;;
  ProgramArguments.2) printf '%s\\n' example/seed-mlx ;;
  ProgramArguments.3) printf '%s\\n' --host ;;
  ProgramArguments.4) printf '%s\\n' 127.0.0.1 ;;
  ProgramArguments.5) printf '%s\\n' --port ;;
  ProgramArguments.6) printf '%s\\n' 8124 ;;
  ProgramArguments.7) printf '%s\\n' --max-tokens ;;
  ProgramArguments.8) printf '%s\\n' 256 ;;
  ProgramArguments.9) printf '%s\\n' --prompt-cache-size ;;
  ProgramArguments.10) printf '%s\\n' 6 ;;
  ProgramArguments.11) printf '%s\\n' --prompt-cache-bytes ;;
  ProgramArguments.12) printf '%s\\n' 2147483648 ;;
  ProgramArguments.13) printf '%s\\n' --log-level ;;
  ProgramArguments.14) printf '%s\\n' INFO ;;
  status) printf '%s\\n' ok ;;
  choices.0.text) printf '%s\\n' suffixOnlyIdentifier ;;
  *) exit 1 ;;
esac
`,
    );
    writeExecutable(
      join(bin, "curl"),
      `#!/bin/sh
case "$*" in
  *http://127.0.0.1:8124/health*)
    printf '%s\\n' '{"status":"ok"}'
    ;;
  *http://127.0.0.1:8124/v1/completions*)
    printf '%s\\n' '{"choices":[{"text":"suffixOnlyIdentifier"}]}'
    ;;
  *)
    exit 22
    ;;
esac
`,
    );

    writeFileSync(
      join(launchAgents, "io.github.roboalchemist.reticle.seed-mlx.plist"),
      "<plist><dict><key>ProgramArguments</key><array/></dict></plist>\n",
    );

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: home,
      PATH: `${bin}:/usr/bin:/bin`,
    };
    for (const name of [
      "RETICLE_SEED_MODEL",
      "RETICLE_SEED_PORT",
      "RETICLE_SEED_PROMPT_CACHE_SIZE",
      "RETICLE_SEED_PROMPT_CACHE_BYTES",
      "RETICLE_SEED_HOME",
      "RETICLE_SEED_VENV",
    ]) {
      delete env[name];
    }

    const result = spawnSync(join(process.cwd(), "scripts", "seed-mlx-service"), ["doctor"], {
      encoding: "utf8",
      env,
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("configured endpoint: http://127.0.0.1:8124");
    expect(result.stdout).toContain("configured model: example/seed-mlx");
    expect(result.stdout).toContain("configured cache: entries=6 bytes=2147483648");
    expect(result.stdout).toContain("PASS runtime: mlx-lm=0.31.1 mlx=0.30.5");
    expect(result.stdout).toContain("PASS health: status=ok");
    expect(result.stdout).toContain("PASS FIM probe: suffixOnlyIdentifier");
    expect(result.stdout).toContain("Reticle Seed MLX doctor: pass");
  });
});
