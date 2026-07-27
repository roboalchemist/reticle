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

describe("Reticle MLX service helper", () => {
  it("uses the installed command name and documents cache controls", () => {
    const directory = mkdtempSync(join(tmpdir(), "reticle-mlx-"));
    temporaryDirectories.push(directory);
    const installedCommand = join(directory, "reticle-mlx");
    symlinkSync(join(process.cwd(), "scripts", "reticle-mlx"), installedCommand);

    const result = spawnSync(installedCommand, ["--help"], { encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Usage: reticle-mlx COMMAND");
    expect(result.stdout).toContain("RETICLE_MLX_PROMPT_CACHE_SIZE");
    expect(result.stdout).toContain("RETICLE_MLX_PROMPT_CACHE_BYTES");
    expect(result.stdout).toContain("RETICLE_MLX_FIM_FORMAT");
    expect(result.stdout).toContain("RETICLE_MLX_MLX_VERSION");
    expect(result.stdout).toContain("doctor");
    expect(result.stdout).toContain("monitor");
  });

  it("rejects invalid port and prompt cache settings before external work", () => {
    const command = join(process.cwd(), "scripts", "reticle-mlx");
    const invalidPort = spawnSync(command, ["--help"], {
      encoding: "utf8",
      env: { ...process.env, RETICLE_MLX_PORT: "70000" },
    });
    const invalidCache = spawnSync(command, ["--help"], {
      encoding: "utf8",
      env: { ...process.env, RETICLE_MLX_PROMPT_CACHE_SIZE: "0" },
    });
    const invalidFormat = spawnSync(command, ["--help"], {
      encoding: "utf8",
      env: { ...process.env, RETICLE_MLX_FIM_FORMAT: "chat" },
    });

    expect(invalidPort.status).toBe(1);
    expect(invalidPort.stderr).toContain("must be at most 65535");
    expect(invalidCache.status).toBe(1);
    expect(invalidCache.stderr).toContain("must be a positive integer");
    expect(invalidFormat.status).toBe(1);
    expect(invalidFormat.stderr).toContain("must be codestral, seed, qwen, or openai");
  });

  it("loads the installed model format and verifies real FIM behavior", () => {
    const home = mkdtempSync(join(tmpdir(), "reticle-mlx-home-"));
    temporaryDirectories.push(home);
    const bin = join(home, "bin");
    const venvBin = join(home, ".reticle", "mlx", "venv", "bin");
    const launchAgents = join(home, "Library", "LaunchAgents");
    const codeSettings = join(home, "Library", "Application Support", "Code", "User");
    mkdirSync(bin, { recursive: true });
    mkdirSync(venvBin, { recursive: true });
    mkdirSync(launchAgents, { recursive: true });
    mkdirSync(codeSettings, { recursive: true });

    writeExecutable(join(venvBin, "mlx_lm.server"), "#!/bin/sh\nexit 0\n");
    writeExecutable(
      join(venvBin, "python"),
      `#!/bin/sh
if [ "$1" = "-c" ]; then
  printf '%s\\n' '0.31.1 0.30.5'
else
  exec /usr/bin/python3 "$@"
fi
`,
    );
    writeExecutable(join(bin, "launchctl"), "#!/bin/sh\nexit 0\n");
    writeExecutable(
      join(bin, "code"),
      `#!/bin/sh
case "$1" in
  --list-extensions) printf '%s\\n' 'roboalchemist.reticle@0.8.0' ;;
  --install-extension) printf '%s\\n' 'Extension installed.' ;;
  *) exit 2 ;;
esac
`,
    );
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
  EnvironmentVariables.RETICLE_MLX_FIM_FORMAT) printf '%s\\n' qwen ;;
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
    case "$*" in
      *'<|fim_prefix|>'*'<|fim_suffix|>'*'<|fim_middle|>'*)
        printf '%s\\n' '{"choices":[{"text":"suffixOnlyIdentifier"}]}'
        ;;
      *) exit 22 ;;
    esac
    ;;
  *)
    exit 22
    ;;
esac
`,
    );

    writeFileSync(
      join(launchAgents, "io.github.roboalchemist.reticle-mlx.plist"),
      "<plist><dict><key>ProgramArguments</key><array/></dict></plist>\n",
    );
    writeFileSync(
      join(codeSettings, "settings.json"),
      `{
  // Reticle's user-level settings
  "reticle.baseURL": "http://127.0.0.1:8124/v1",
  "reticle.model": "example/seed-mlx",
  "reticle.fimFormat": "qwen",
}
`,
    );

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: home,
      PATH: `${bin}:/usr/bin:/bin`,
      RETICLE_CODE_BIN: join(bin, "code"),
    };
    for (const name of [
      "RETICLE_MLX_MODEL",
      "RETICLE_MLX_FIM_FORMAT",
      "RETICLE_MLX_PORT",
      "RETICLE_MLX_PROMPT_CACHE_SIZE",
      "RETICLE_MLX_PROMPT_CACHE_BYTES",
      "RETICLE_MLX_HOME",
      "RETICLE_MLX_VENV",
    ]) {
      delete env[name];
    }

    const result = spawnSync(join(process.cwd(), "scripts", "reticle-mlx"), ["doctor"], {
      encoding: "utf8",
      env,
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("configured endpoint: http://127.0.0.1:8124");
    expect(result.stdout).toContain("configured model: example/seed-mlx");
    expect(result.stdout).toContain("configured FIM format: qwen");
    expect(result.stdout).toContain("configured cache: entries=6 bytes=2147483648");
    expect(result.stdout).toContain("PASS runtime: mlx-lm=0.31.1 mlx=0.30.5");
    expect(result.stdout).toContain("PASS health: status=ok");
    expect(result.stdout).toContain("PASS FIM probe: suffixOnlyIdentifier");
    expect(result.stdout).toContain("Reticle MLX doctor: pass");

    const extensionInstall = spawnSync(
      join(process.cwd(), "scripts", "reticle-mlx"),
      ["vscode-install"],
      { encoding: "utf8", env },
    );
    expect(extensionInstall.status).toBe(0);
    expect(extensionInstall.stdout).toContain("Extension installed.");

    const extensionDoctor = spawnSync(
      join(process.cwd(), "scripts", "reticle-mlx"),
      ["vscode-doctor"],
      { encoding: "utf8", env },
    );
    expect(extensionDoctor.status).toBe(0);
    expect(extensionDoctor.stderr).toBe("");
    expect(extensionDoctor.stdout).toContain("PASS extension: roboalchemist.reticle@0.8.0");
    expect(extensionDoctor.stdout).toContain("PASS VS Code setting: reticle.baseURL");
    expect(extensionDoctor.stdout).toContain("PASS endpoint: http://127.0.0.1:8124/health");
    expect(extensionDoctor.stdout).toContain(
      "PASS extension-shaped FIM probe: suffixOnlyIdentifier",
    );
    expect(extensionDoctor.stdout).toContain("Reticle VS Code doctor: pass");

    writeExecutable(
      join(bin, "curl"),
      `#!/bin/sh
case "$*" in
  *http://127.0.0.1:8124/health*)
    printf '%s\\n' '{"ok":true}'
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
    const mtplxShapedExtensionDoctor = spawnSync(
      join(process.cwd(), "scripts", "reticle-mlx"),
      ["vscode-doctor"],
      { encoding: "utf8", env },
    );
    expect(mtplxShapedExtensionDoctor.status).toBe(0);
    expect(mtplxShapedExtensionDoctor.stderr).toBe("");
    expect(mtplxShapedExtensionDoctor.stdout).toContain(
      "PASS endpoint: http://127.0.0.1:8124/health",
    );
  });
});
