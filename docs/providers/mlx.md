# Reticle MLX for macOS

Reticle MLX is the native Apple Silicon companion for Reticle. It manages a
loopback-only MLX-LM service, keeps the selected model warm, retains bounded
prompt caches, and makes service health visible from the menu bar.

Seed-Coder is the default quality preset, not a product dependency. You can use
the included Qwen speed preset or any compatible MLX-LM model and FIM transport.

## Requirements

- Apple Silicon Mac running macOS 13 or later
- At least 16 GB unified memory for the included presets
- About 5 GB free disk space for the default model and private runtime
- The Reticle VS Code extension

The app and service connect only through `127.0.0.1`. MLX-LM's development
server is not intended to be exposed to a LAN or the internet.

## Install the signed menu-bar app

Install the Apple-notarized release through Homebrew:

```bash
brew install --cask roboalchemist/tap/reticle-mlx
open -g -a "Reticle MLX"
```

Or download `Reticle-MLX-<version>.dmg` from the
[latest release](https://github.com/roboalchemist/reticle-mlx/releases/latest),
open it, and copy **Reticle MLX.app** to Applications.

Open the menu-bar sparkle, choose **Settings…**, select a model, and click
**Install Model & Service**. Installation creates an isolated Python
environment under `~/.reticle/mlx`, downloads the model through Hugging Face,
installs a per-user LaunchAgent, starts MLX-LM, and warms the actual FIM path.
It does not require administrator privileges.

The menu provides:

- current health and selected model;
- start, stop, and restart;
- a suffix-dependent doctor probe;
- the service log folder;
- model, FIM, port, and prompt-cache settings; and
- optional launch at login.

## Model presets

| Preset                   | Model                                            | FIM format | Use                      |
| ------------------------ | ------------------------------------------------ | ---------- | ------------------------ |
| Seed-Coder 8B — quality  | `roboalchemist/Seed-Coder-8B-Base-MLX-mixed-3-4` | `seed`     | Best tested FIM quality  |
| Qwen2.5-Coder 3B — speed | `mlx-community/Qwen2.5-Coder-3B-Instruct-4bit`   | `qwen`     | Lower latency and memory |
| Custom MLX model         | Hugging Face model ID or local path              | selectable | Advanced use             |

A model must actually support fill in the middle. Selecting a marker format
does not add FIM capability to a chat-only checkpoint. After every model
change, run **Doctor** and confirm `suffixOnlyIdentifier`.

The **Copy VS Code Settings** button produces the matching endpoint, model, and
`reticle.fimFormat` configuration.

## Headless installation

The same manager can be used without the app:

```bash
brew install roboalchemist/tap/reticle-mlx
reticle-mlx install
reticle-mlx doctor
```

The default is the Seed quality preset. To select another model:

```bash
RETICLE_MLX_MODEL=mlx-community/Qwen2.5-Coder-3B-Instruct-4bit \
RETICLE_MLX_FIM_FORMAT=qwen \
reticle-mlx install
```

Custom install settings are remembered in the LaunchAgent:

```bash
RETICLE_MLX_MODEL=/path/to/local-mlx-model \
RETICLE_MLX_FIM_FORMAT=seed \
RETICLE_MLX_PORT=8011 \
RETICLE_MLX_PROMPT_CACHE_SIZE=4 \
RETICLE_MLX_PROMPT_CACHE_BYTES=2147483648 \
reticle-mlx install
```

Use the same port, model, and FIM format in the VS Code extension.

## Operate and monitor

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

- `status` prints the remembered endpoint, model, FIM format, cache bounds,
  LaunchAgent state, PID, exit status, and current health response.
- `monitor` refreshes compact launchd and health state until interrupted.
- `logs` follows stdout and stderr.
- `doctor` checks the executable, exact MLX runtime pair, LaunchAgent, health
  endpoint, and a real suffix-dependent insertion.

## Measured Mac performance

On a 128 GB M3 Max with MLX-LM 0.31.1:

| Path                                            |         First token / complete insertion |                              Decode |
| ----------------------------------------------- | ---------------------------------------: | ----------------------------------: |
| Seed mixed 3/4-bit MLX, 133-token prompt        |   284 ms uncached / 648 ms for 33 tokens |                          93.2 tok/s |
| Seed mixed 3/4-bit, incremental identifier edit |                    134–151 ms end to end | 34–35 of 36–37 prompt tokens cached |
| Seed uniform 4-bit MLX                          |   283 ms uncached / 808 ms for 41 tokens |                          79.5 tok/s |
| Seed GGUF Q4_K_M through llama.cpp              | 214 ms uncached / 1,186 ms for 64 tokens |                          65.8 tok/s |

Qwen2.5-Coder 3B decoded faster in the same model survey, but Seed-Coder
produced the best FIM quality in the multilingual completion probes. These
measurements describe one machine and workload, not a universal guarantee.

## Why prompt caching instead of EAGLE, MTP, or the ANE?

No public Seed-Coder 8B Base EAGLE, EAGLE3, Medusa, MTP, compatible draft
checkpoint, or quality-preserving ANE artifact was available in the July 2026
survey. N-gram speculation accelerated exact repeated generations but did not
improve fresh edits consistently. Four-bit KV cache also regressed this
workload. Incremental MLX prompt caching was the useful editor-path
acceleration.

Reticle MLX deliberately exposes a generic model slot so a future speculative
head or improved ANE conversion can be added as a preset without changing the
app or extension identity.

## Migration from `reticle-seed-mlx`

The first `reticle-mlx install` stops the legacy
`io.github.roboalchemist.reticle.seed-mlx` LaunchAgent so it cannot contend for
port 8001. After the new service passes health and FIM warmup, the legacy plist
is removed. The old `~/.reticle/seed-mlx` environment and logs are preserved,
and the Hugging Face cache is shared.

## Uninstall

```bash
reticle-mlx uninstall
brew uninstall reticle-mlx
brew uninstall --cask reticle-mlx
```

The command removes the LaunchAgent but preserves the private runtime, model
cache, and logs. Delete `~/.reticle/mlx` separately only when you no longer need
them.
