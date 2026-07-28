# Reticle MLX for macOS

Reticle MLX is the native Apple Silicon companion for Reticle. The menu-bar app
downloads, selects, starts, stops, diagnoses, and monitors local code-completion
models. It deliberately uses two runtimes:

- **MLX-LM** is the general loader for Qwen2.5-Coder, Seed-Coder, Codestral, and
  compatible custom MLX models.
- **MTPLX** is the optimized speculative runtime for the verified Qwen3.5 9B
  native-MTP checkpoint.

Seed-Coder is the recommended quality preset, not a product dependency.

## Requirements

- Apple Silicon Mac running macOS 14 or later
- 8 GB unified memory for Qwen 1.5B; 16 GB or more for Seed and MTPLX
- 32 GB or more for comfortable Codestral 22B use
- Enough free disk space for the selected model

Both runtimes bind only to `127.0.0.1`. Do not expose their development servers
to a LAN or the internet.

## Install the signed menu-bar app

Install the Apple-notarized release through Homebrew:

```bash
brew install --cask roboalchemist/tap/reticle-mlx
open -g -a "Reticle MLX"
```

Or download `Reticle-MLX-<version>.dmg` from the
[latest release](https://github.com/roboalchemist/reticle-mlx/releases/latest),
open it, and copy **Reticle MLX.app** to Applications.

Open the menu-bar icon and choose **Settings…**. The resizable window opens on
**General**. Its sidebar stays visible and switches between **Models**, **Custom
Model**, **Benchmark**, **VS Code Setup**, and **Logs**. The Activity divider is
draggable on every tab. The Models tab is independently scrollable, ranks
recommended presets first, and lists every supported model as a card with its
purpose, runtime, approximate download size, memory floor, and relative
quality/speed/memory scores.

1. Open **Models** and click **Download** on a model card. The progress bar reports real downloaded
   bytes, transfer speed, and ETA. **Pause**, **Resume**, and **Cancel** control
   the actual download worker; already completed files are preserved.
2. Click **Select**, return to **General**, then click **Apply & Restart**. The app stops the other runtime
   before starting the selected one, so MLX-LM and MTPLX do not compete for
   memory.
3. Open **VS Code Setup** and click **Install VS Code Extension**.
4. Click **Copy VS Code Settings**, apply the copied settings, and run **VS Code
   Doctor**. The doctor checks VS Code, the installed extension, user settings,
   endpoint health, and a suffix-dependent live FIM insertion.

The app can launch at login and provides service lifecycle controls, logs,
health, automatic updates, and a model-specific doctor.

## Benchmark models

Open **Benchmark**, choose any downloaded preset, and click **Start Model &
Benchmark**. This intentionally changes the active service to the selected
model. Reticle sends the same FIM-shaped prompt once with a new prompt-cache
session and three more times with that session warmed. It reports:

- streaming time to first token (TTFT);
- cold end-to-end request time;
- median warm end-to-end request time; and
- completion tokens per second.

When a server omits token usage, Reticle marks throughput with `*` and estimates
tokens from the streamed output. Results remain in the comparison table while
the settings window is open. Use **Copy Results** for tab-separated clipboard
output or **Export TSV…** for a file.

## Inspect logs

The **Logs** tab reads the active runtime's stdout and stderr without loading an
unbounded file into the app. Use **Refresh Logs**, **Run Service Doctor**, **Copy
All**, **Export…**, or **Open Folder**. This is the fastest way to diagnose a
service that remains in **Starting or unhealthy**.

## Supported model cards

All five presets below were downloaded and exercised through their real managed
runtime on an Apple M3 Max. Each returned the suffix-only identifier required by
Reticle's FIM doctor.

| Preset                      | Runtime | Download | Memory floor | Best for                          |
| --------------------------- | ------- | -------: | -----------: | --------------------------------- |
| Qwen2.5-Coder 1.5B Base     | MLX-LM  |   0.9 GB |         8 GB | Lowest latency and memory         |
| Qwen2.5-Coder 3B Base       | MLX-LM  |   1.7 GB |        12 GB | Balanced everyday use             |
| Qwen3.5 9B Optimized Speed  | MTPLX   |   8.7 GB |        16 GB | Speculative multi-line completion |
| Seed-Coder 8B mixed 3/4-bit | MLX-LM  |   3.6 GB |        16 GB | Best tested completion quality    |
| Codestral 22B 4-bit         | MLX-LM  |  12.5 GB |        32 GB | Large FIM-native model            |

The Qwen presets intentionally use **Base** checkpoints. An Instruct/chat model
is not a substitute for a FIM-trained model.

Codestral's community MLX conversion contains correct weights but an old
Transformers tokenizer that does not expose its FIM control IDs. Reticle creates
a small prepared-model overlay using Mistral's official v3 tokenizer and
symlinks to the downloaded weights. It does not duplicate the 12.5 GB model.

## Where models are stored

MLX-LM presets use the standard Hugging Face cache:

```text
~/.cache/huggingface/hub/
```

The private, pinned MLX-LM environment, logs, and Codestral tokenizer overlay
live under:

```text
~/.reticle/mlx/
```

MTPLX uses its own resumable downloader and model cache:

```text
~/.mtplx/models/
```

MTPLX logs and persistent session-cache metadata remain under `~/.mtplx/`.
Uninstalling the app or LaunchAgents preserves models and caches.

## Runtime controls

The server port is shared with the matching VS Code configuration. MLX-LM also
exposes the number of retained prompt caches and their combined byte limit.
MTPLX manages its own persistent session cache, so those two fields are disabled
when its card is selected.

The default ports are:

- MLX-LM: `8001`
- MTPLX: `8000`

Only one selected runtime is kept active by the app.

## Headless MLX-LM operation

```bash
brew install roboalchemist/tap/reticle-mlx
reticle-mlx download
reticle-mlx install
reticle-mlx doctor
```

The default is the Seed quality preset. To select Qwen 3B:

```bash
RETICLE_MLX_MODEL=mlx-community/Qwen2.5-Coder-3B-4bit \
RETICLE_MLX_FIM_FORMAT=qwen \
reticle-mlx download

RETICLE_MLX_MODEL=mlx-community/Qwen2.5-Coder-3B-4bit \
RETICLE_MLX_FIM_FORMAT=qwen \
RETICLE_MLX_SKIP_DOWNLOAD=1 \
reticle-mlx install
```

Custom MLX-LM settings are remembered in the per-user LaunchAgent:

```bash
RETICLE_MLX_MODEL=/path/to/local-mlx-model \
RETICLE_MLX_FIM_FORMAT=seed \
RETICLE_MLX_PORT=8011 \
RETICLE_MLX_PROMPT_CACHE_SIZE=4 \
RETICLE_MLX_PROMPT_CACHE_BYTES=2147483648 \
reticle-mlx install
```

Use `default_model` as `reticle.model` when connecting the extension to the
single-model managed MLX-LM service.

## Headless MTPLX operation

The app bundles the service helper; it installs the official MTPLX Homebrew
formula when needed. A standalone installation is also available:

```bash
brew install roboalchemist/tap/reticle-mtplx
reticle-mtplx download
reticle-mtplx install
reticle-mtplx doctor
```

For continuous monitoring:

```bash
reticle-mtplx status
reticle-mtplx monitor
reticle-mtplx logs
```

The detailed runtime guide is in [MTPLX](mtplx.md).

## Operate and monitor

For MLX-LM:

```bash
reticle-mlx status
reticle-mlx health
reticle-mlx monitor
reticle-mlx logs
reticle-mlx doctor
reticle-mlx restart
reticle-mlx stop
reticle-mlx start
```

`status` prints the remembered endpoint, source model, FIM format, cache bounds,
LaunchAgent state, PID, exit status, and health response. `doctor` verifies the
pinned runtime pair and runs a real suffix-dependent insertion, not just an HTTP
health check.

## Measured Mac performance

On a 128 GB M3 Max:

| Path                                            |                               Result |
| ----------------------------------------------- | -----------------------------------: |
| MTPLX Qwen3.5 9B live provider                  |                         about 301 ms |
| MTPLX Qwen3.5 9B VS Code extension host         |                         about 384 ms |
| Seed mixed 3/4-bit, uncached 33-token insertion | 284 ms first token / 648 ms complete |
| Seed mixed 3/4-bit, incremental identifier edit |                134–151 ms end to end |
| Seed mixed 3/4-bit decode                       |                        93.2 tokens/s |
| Seed uniform 4-bit decode                       |                        79.5 tokens/s |

These measurements describe one machine and workload. Qwen 1.5B is the lowest
latency MLX-LM preset; Seed produced the best FIM quality in Reticle's
multilingual probes. MTPLX provides the specialized speculative path that
MLX-LM does not.

## Migration from `reticle-seed-mlx`

The first `reticle-mlx install` stops the legacy
`io.github.roboalchemist.reticle.seed-mlx` LaunchAgent so it cannot contend for
port 8001. After the replacement service passes health and FIM warmup, the
legacy plist is removed. The old runtime and logs are preserved.

## Uninstall

```bash
reticle-mlx uninstall
reticle-mtplx uninstall
brew uninstall --cask reticle-mlx
```

The commands remove their LaunchAgents but preserve private runtimes, model
caches, session caches, and logs.
