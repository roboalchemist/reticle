# Seed-Coder on MLX

This is Reticle's quality-first local backend for Apple Silicon. It combines
ByteDance Seed's FIM-trained 8B Base model with MLX-LM's Metal runtime,
mixed-bit quantization, and incremental prompt caching.

## Requirements

- Apple Silicon Mac
- macOS
- At least 16 GB of unified memory
- Homebrew and Python 3
- About 5 GB of free disk space for the model and private runtime

The service binds only to `127.0.0.1`. MLX-LM warns that its server provides
only basic security checks, so do not expose this port to a LAN or the internet.

## Install

```bash
brew install roboalchemist/tap/reticle-seed-mlx
reticle-seed-mlx install
reticle-seed-mlx doctor
```

`install`:

1. creates an isolated Python environment under `~/.reticle/seed-mlx`;
2. installs the tested MLX-LM 0.31.1 + MLX 0.30.5 runtime pair;
3. downloads
   [`roboalchemist/Seed-Coder-8B-Base-MLX-mixed-3-4`](https://huggingface.co/roboalchemist/Seed-Coder-8B-Base-MLX-mixed-3-4);
4. installs a per-user LaunchAgent bound to `127.0.0.1:8001`;
5. retains eight incremental prompt caches, bounded to 4 GB; and
6. warms and verifies a suffix-dependent Seed FIM request.

No administrator privileges are used after Homebrew installs the helper.

## Configure Reticle

```jsonc
{
  "reticle.baseURL": "http://127.0.0.1:8001/v1",
  "reticle.model": "roboalchemist/Seed-Coder-8B-Base-MLX-mixed-3-4",
  "reticle.fimFormat": "seed",
  "reticle.temperature": 0,
  "reticle.maxTokens": 64,
  "reticle.maxLines": 8,
}
```

Run **Reticle: Test Autocomplete Endpoint**. The probe should return
`suffixOnlyIdentifier`.

Seed-Coder's native format is:

```text
<[fim-suffix]>CODE_AFTER_CURSOR<[fim-prefix]>CODE_BEFORE_CURSOR<[fim-middle]>
```

Reticle performs this serialization when `reticle.fimFormat` is `seed`; do not
manually add the markers to source code.

## Operate and monitor

```bash
reticle-seed-mlx status
reticle-seed-mlx health
reticle-seed-mlx monitor
reticle-seed-mlx logs
reticle-seed-mlx doctor
reticle-seed-mlx restart
reticle-seed-mlx stop
reticle-seed-mlx start
```

- `status` prints the remembered endpoint, model, cache bounds, launchd
  process state, PID, exit status, and current health response.
- `monitor` refreshes compact launchd and health state until interrupted.
- `logs` follows both server logs.
- `doctor` checks the executable, LaunchAgent, health endpoint, and a real
  suffix-dependent insertion. It also rejects an untested MLX/MLX-LM version
  pairing instead of trusting a health endpoint that may pass before generation
  fails.

Custom install settings are remembered in the LaunchAgent. Explicit
environment variables override them:

```bash
RETICLE_SEED_PORT=8011 \
RETICLE_SEED_PROMPT_CACHE_SIZE=4 \
RETICLE_SEED_PROMPT_CACHE_BYTES=2147483648 \
reticle-seed-mlx install
```

Use the same port in `reticle.baseURL`. More cache entries improve reuse across
several active files but consume additional unified memory. The byte ceiling is
a hard aggregate bound for stored KV caches, separate from model memory.

## Measured Mac performance

On a 128 GB M3 Max with MLX-LM 0.31.1:

| Path                                            |         First token / complete insertion |                              Decode |
| ----------------------------------------------- | ---------------------------------------: | ----------------------------------: |
| Mixed 3/4-bit MLX, 133-token prompt             |   284 ms uncached / 648 ms for 33 tokens |                          93.2 tok/s |
| Mixed 3/4-bit MLX, incremental identifier edits |                    134–146 ms end to end | 34–35 of 36–37 prompt tokens cached |
| Uniform 4-bit MLX                               |   283 ms uncached / 808 ms for 41 tokens |                          79.5 tok/s |
| GGUF Q4_K_M through llama.cpp                   | 214 ms uncached / 1,186 ms for 64 tokens |                          65.8 tok/s |

The mixed 3/4-bit build also produced valid insertions across eight
TypeScript, JavaScript, Python, Go, and Rust probes. Measurements describe this
machine and workload, not a universal speed or quality guarantee.

## Why not EAGLE, MTP, or the ANE?

No public Seed-Coder 8B Base EAGLE, EAGLE3, Medusa, MTP, or compatible smaller
draft checkpoint was available in the July 2026 search. Lossless llama.cpp
N-gram speculation accelerated exact repeated generations, but did not improve
fresh edits consistently; MLX prompt caching was the useful editor workload
win.

The model runs on the Apple GPU through MLX. A generic Core ML conversion could
target the Apple Neural Engine, but the available conversion path did not offer
a Seed-specific artifact and warned of lower LUT4 quality without block
quantization. Reticle therefore keeps the measured MLX path as the default
quality/speed tradeoff.

## Uninstall

```bash
reticle-seed-mlx uninstall
brew uninstall reticle-seed-mlx
```

The command removes the LaunchAgent but deliberately preserves the private
environment, Hugging Face model cache, and logs. Remove those separately only
when you no longer need them:

```bash
rm -rf ~/.reticle/seed-mlx
```

The model lives in the normal Hugging Face cache and can be inspected or
removed with the Hugging Face CLI.
