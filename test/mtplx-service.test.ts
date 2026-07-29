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
    expect(result.stdout).toContain("MTPLX_SKIP_FIM_WARMUP");
    expect(result.stdout).toContain("download");
    expect(result.stdout).toContain("model-status");
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

  it("reports launchd process details when health is unavailable", () => {
    const home = mkdtempSync(join(tmpdir(), "reticle-mtplx-status-"));
    temporaryDirectories.push(home);
    const bin = join(home, "bin");
    const launchAgents = join(home, "Library", "LaunchAgents");
    mkdirSync(bin, { recursive: true });
    mkdirSync(launchAgents, { recursive: true });
    writeFileSync(
      join(launchAgents, "io.github.roboalchemist.reticle.mtplx.plist"),
      "<plist><dict/></plist>\n",
    );
    writeExecutable(
      join(bin, "launchctl"),
      `#!/bin/sh
printf '%s\\n' 'state = running'
printf '%s\\n' 'pid = 123'
printf '%s\\n' 'last exit code = (never exited)'
`,
    );
    writeExecutable(join(bin, "curl"), "#!/bin/sh\nexit 22\n");
    writeExecutable(join(bin, "plutil"), "#!/bin/sh\nexit 1\n");

    const result = spawnSync(join(process.cwd(), "scripts", "mtplx-service"), ["status"], {
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: home,
        PATH: `${bin}:/usr/bin:/bin`,
        MTPLX_MODEL: "example/model",
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("launchd: loaded");
    expect(result.stdout).toContain("state = running");
    expect(result.stdout).toContain("pid = 123");
    expect(result.stdout).toContain("health: unavailable");
  });

  it("diagnoses the installed custom service and verifies real FIM behavior", () => {
    const home = mkdtempSync(join(tmpdir(), "reticle-mtplx-home-"));
    temporaryDirectories.push(home);
    const bin = join(home, "bin");
    const launchAgents = join(home, "Library", "LaunchAgents");
    mkdirSync(bin, { recursive: true });
    mkdirSync(launchAgents, { recursive: true });

    const mtplx = join(bin, "mtplx");
    writeExecutable(mtplx, "#!/bin/sh\nexit 0\n");
    writeExecutable(join(bin, "launchctl"), "#!/bin/sh\nexit 0\n");
    writeExecutable(
      join(bin, "plutil"),
      `#!/bin/sh
case "$2" in
  ProgramArguments) printf '%s\\n' 18 ;;
  ProgramArguments.0) printf '%s\\n' '${mtplx}' ;;
  ProgramArguments.1) printf '%s\\n' serve ;;
  ProgramArguments.2) printf '%s\\n' --model ;;
  ProgramArguments.3) printf '%s\\n' example/custom-model ;;
  ProgramArguments.4) printf '%s\\n' --profile ;;
  ProgramArguments.5) printf '%s\\n' sustained ;;
  ProgramArguments.6) printf '%s\\n' --host ;;
  ProgramArguments.7) printf '%s\\n' 127.0.0.1 ;;
  ProgramArguments.8) printf '%s\\n' --port ;;
  ProgramArguments.9) printf '%s\\n' 8123 ;;
  ProgramArguments.10) printf '%s\\n' --batching-preset ;;
  ProgramArguments.11) printf '%s\\n' latency ;;
  ProgramArguments.12) printf '%s\\n' --ssd-session-cache ;;
  ProgramArguments.13) printf '%s\\n' on ;;
  ProgramArguments.14) printf '%s\\n' --context-window ;;
  ProgramArguments.15) printf '%s\\n' 12288 ;;
  ProgramArguments.16) printf '%s\\n' --paged-kv-quantization ;;
  ProgramArguments.17) printf '%s\\n' q8 ;;
  ok) printf '%s\\n' true ;;
  generation_mode) printf '%s\\n' mtp ;;
  mtp_enabled) printf '%s\\n' true ;;
  model) printf '%s\\n' custom-served-model ;;
  profile.name) printf '%s\\n' sustained ;;
  warmup.error) exit 1 ;;
  choices.0.text) printf '%s\\n' suffixOnlyIdentifier ;;
  *) exit 1 ;;
esac
`,
    );
    writeExecutable(
      join(bin, "curl"),
      `#!/bin/sh
case "$*" in
  *http://127.0.0.1:8123/health*)
    printf '%s\\n' '{"ok":true,"model":"custom-served-model","generation_mode":"mtp","mtp_enabled":true,"profile":{"name":"sustained"},"warmup":{"error":null}}'
    ;;
  *http://127.0.0.1:8123/v1/completions*)
    printf '%s\\n' '{"choices":[{"text":"suffixOnlyIdentifier"}]}'
    ;;
  *)
    exit 22
    ;;
esac
`,
    );

    const plist = join(launchAgents, "io.github.roboalchemist.reticle.mtplx.plist");
    writeFileSync(
      plist,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>ProgramArguments</key>
  <array>
    <string>${mtplx}</string>
    <string>serve</string>
    <string>--model</string>
    <string>example/custom-model</string>
    <string>--profile</string>
    <string>sustained</string>
    <string>--host</string>
    <string>127.0.0.1</string>
    <string>--port</string>
    <string>8123</string>
    <string>--batching-preset</string>
    <string>latency</string>
    <string>--ssd-session-cache</string>
    <string>on</string>
    <string>--context-window</string>
    <string>12288</string>
    <string>--paged-kv-quantization</string>
    <string>q8</string>
  </array>
</dict>
</plist>
`,
    );

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: home,
      PATH: `${bin}:/usr/bin:/bin`,
    };
    for (const name of [
      "MTPLX_MODEL",
      "MTPLX_PORT",
      "MTPLX_PROFILE",
      "MTPLX_CONTEXT_WINDOW",
      "MTPLX_KV_QUANTIZATION",
    ]) {
      delete env[name];
    }

    const result = spawnSync(join(process.cwd(), "scripts", "mtplx-service"), ["doctor"], {
      encoding: "utf8",
      env,
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("configured endpoint: http://127.0.0.1:8123");
    expect(result.stdout).toContain("configured model: example/custom-model");
    expect(result.stdout).toContain("configured runtime: profile=sustained context=12288 kv=q8");
    expect(result.stdout).toContain(
      "PASS health: model=custom-served-model profile=sustained mode=mtp mtp=true",
    );
    expect(result.stdout).toContain("PASS FIM probe: suffixOnlyIdentifier");
    expect(result.stdout).toContain("Reticle MTPLX doctor: pass");
  });

  it("exposes native MTPLX download progress and validates the cached model", () => {
    const home = mkdtempSync(join(tmpdir(), "reticle-mtplx-download-"));
    temporaryDirectories.push(home);
    const bin = join(home, "bin");
    mkdirSync(bin, { recursive: true });
    writeExecutable(join(bin, "plutil"), "#!/bin/sh\nexit 1\n");
    const mtplx = join(home, "mtplx");
    writeExecutable(
      mtplx,
      `#!/bin/sh
case "$1" in
  pull)
    printf '%s\\n' '{"event":"start","size_bytes":0,"total_bytes":100}'
    printf '%s\\n' '{"event":"progress","size_bytes":50,"total_bytes":100,"file":"weights"}'
    printf '%s\\n' '{"event":"complete","size_bytes":100,"total_bytes":100}'
    ;;
  inspect)
    printf '%s\\n' '{"compatibility":{"can_run":true},"mtp":{"exists":true}}'
    ;;
  *) exit 2 ;;
esac
`,
    );
    const env = {
      ...process.env,
      HOME: home,
      MTPLX_BIN: mtplx,
      MTPLX_MODEL: "example/native-mtp",
      PATH: `${bin}:/usr/bin:/bin`,
    };

    const download = spawnSync(join(process.cwd(), "scripts", "mtplx-service"), ["download"], {
      encoding: "utf8",
      env,
    });
    const status = spawnSync(join(process.cwd(), "scripts", "mtplx-service"), ["model-status"], {
      encoding: "utf8",
      env,
    });

    expect(download.status).toBe(0);
    expect(download.stdout).toContain("RETICLE_DOWNLOAD_WORKER");
    expect(download.stdout).toContain('"event":"progress"');
    expect(status.status).toBe(0);
    expect(status.stdout).toContain("runtime: mtplx");
    expect(status.stdout).toContain("FIM format: qwen");
  });
});
