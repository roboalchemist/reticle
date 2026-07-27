<p align="center">
  <img src="media/icon.png" width="128" height="128" alt="Reticle logo: code brackets and a completion sparkle">
</p>

<h1 align="center">Reticle + Reticle MLX</h1>

<p align="center">
  <strong>Fast, private code completion on your own endpoint.</strong>
  <br>
  Local-first FIM ghost text for VS Code—with multi-line suggestions, no hosted account, and no telemetry.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=roboalchemist.reticle"><img alt="VS Code Marketplace version" src="https://img.shields.io/visual-studio-marketplace/v/roboalchemist.reticle?label=VS%20Code&color=6574f7"></a>
  <a href="https://open-vsx.org/extension/roboalchemist/reticle"><img alt="Open VSX version" src="https://img.shields.io/open-vsx/v/roboalchemist/reticle?label=Open%20VSX&color=6574f7"></a>
  <a href="https://github.com/roboalchemist/reticle-mlx/actions/workflows/ci.yml"><img alt="Build status" src="https://github.com/roboalchemist/reticle-mlx/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-ff7869"></a>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=roboalchemist.reticle"><strong>Install</strong></a>
  ·
  <a href="#reticle-mlx-for-macos">Reticle MLX for macOS</a>
  ·
  <a href="#quick-start-with-mtplx">MTPLX quick start</a>
  ·
  <a href="#provider-guides">Provider guides</a>
  ·
  <a href="#configuration">Configuration</a>
</p>

---

Reticle connects VS Code directly to an OpenAI-compatible `POST /v1/completions` endpoint. It uses true fill-in-the-middle context to suggest an identifier, a line, or a bounded multi-line block at the cursor.

|                               |                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| **Local and BYOK**            | Use MLX-LM, MTPLX, Ollama, llama.cpp, LM Studio, or a compatible remote endpoint.       |
| **True fill-in-the-middle**   | Sends both the code before and after the cursor instead of prompting a chat model.      |
| **Multi-line with one `Tab`** | Accept an entire bounded block while keeping indentation and suffix overlap intact.     |
| **Small and observable**      | No hosted account or telemetry; inspect your endpoint, service health, logs, and usage. |

The selected model must actually support FIM. Reticle can send a separate OpenAI `suffix`, embed Qwen PSM special tokens, or serialize Seed-Coder's native SPM format for plain-completion servers. Chat-only models are not compatible even when their server implements an OpenAI-shaped API.

## Install

Install `roboalchemist.reticle` from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=roboalchemist.reticle) or [Open VSX](https://open-vsx.org/extension/roboalchemist/reticle):

```bash
code --install-extension roboalchemist.reticle
```

For an offline install, download the VSIX from the [latest GitHub release](https://github.com/roboalchemist/reticle-mlx/releases/latest), then run **Extensions: Install from VSIX...** in VS Code.

## Reticle MLX for macOS

Reticle MLX is the native menu-bar companion for Apple Silicon. It installs,
starts, stops, monitors, and switches MLX-LM completion models without keeping a
terminal open. The app is Developer ID signed, hardened, notarized by Apple, and
distributed from the [latest GitHub release](https://github.com/roboalchemist/reticle-mlx/releases/latest).

```bash
brew install --cask roboalchemist/tap/reticle-mlx
open -g -a "Reticle MLX"
```

Open **Settings…** from the menu-bar sparkle and choose:

- **Seed-Coder 8B — quality:** the recommended 3.6 GB mixed-bit model.
- **Qwen2.5-Coder 3B — speed:** lower latency and memory use.
- **Custom MLX model:** any compatible Hugging Face ID or local model path,
  paired with Seed, Qwen, or OpenAI FIM transport.

Click **Install Model & Service**, then **Copy VS Code Settings**. The app keeps
the service loopback-only, shows health in the menu bar, exposes logs and a real
FIM doctor, and can start at login.

The same manager is available headlessly:

```bash
brew install roboalchemist/tap/reticle-mlx
reticle-mlx install
reticle-mlx doctor
reticle-mlx monitor
```

See the [complete Reticle MLX guide](docs/providers/mlx.md) for model presets,
custom models, measured performance, migration, and lifecycle commands.

## Quick start with MTPLX

On an Apple Silicon Mac with at least 16 GB of unified memory:

```bash
brew install roboalchemist/tap/reticle-mtplx
reticle-mtplx install
reticle-mtplx status
```

Then configure VS Code:

```jsonc
{
  "reticle.baseURL": "http://127.0.0.1:8000/v1",
  "reticle.model": "mtplx-qwen35-9b-optimized-speed",
  "reticle.fimFormat": "qwen",
  "reticle.maxLines": 8,
  "reticle.maxTokens": 64,
}
```

Run **Reticle: Test Autocomplete Endpoint**. See the [complete MTPLX guide](docs/providers/mtplx.md) for monitoring, logs, dashboard, restart, custom models, and uninstall.

## Quick start with Ollama

1. Install [Ollama](https://ollama.com/download), then pull the FIM-trained **Base** checkpoint:

   ```bash
   ollama pull qwen2.5-coder:1.5b-base
   ollama serve
   ```

2. Verify the model/server pair before configuring Reticle:

   ```bash
   curl --silent --show-error http://127.0.0.1:11434/v1/completions \
     -H 'Content-Type: application/json' \
     -d '{
       "model": "qwen2.5-coder:1.5b-base",
       "prompt": "function add(a, b) {\n  return ",
       "suffix": "\n}\n",
       "max_tokens": 32,
       "temperature": 0,
       "stream": false
     }'
   ```

   `choices[0].text` should be a bare insertion such as `a + b`, without a rewritten function, explanation, or Markdown fence.

3. Install the Reticle VSIX, open VS Code Settings, and set:

   ```jsonc
   {
     "reticle.baseURL": "http://127.0.0.1:11434/v1",
     "reticle.model": "qwen2.5-coder:1.5b-base",
   }
   ```

4. Run **Reticle: Test Autocomplete Endpoint** from the Command Palette. Then type after `return ` in a source file. Reticle shows ghost text; press `Tab` to accept the entire single- or multi-line suggestion. Suggestions trigger automatically after a short typing pause. After acceptance, Reticle waits for your next edit before automatically suggesting again. To force one immediately, press `Option+\` on macOS or `Ctrl+Alt+Space` elsewhere.

Disable other inline-completion extensions while validating so their ghost text is not mistaken for Reticle's.

## The compatibility litmus

Use the same request with every provider, changing only the URL, model ID, and optional authorization header:

```bash
curl --silent --show-error https://HOST/v1/completions \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "MODEL_ID",
    "prompt": "function add(a, b) {\n  return ",
    "suffix": "\n}\n",
    "max_tokens": 32,
    "temperature": 0,
    "stream": false
  }'
```

Compatible output has a `choices[0].text` insertion like `a + b`. Once that passes, repeat with `"stream": true`; Reticle uses the streaming path. A server may accept `suffix` while silently ignoring it, so an HTTP 200 alone proves nothing.

## Configuration

| Setting                     |                    Default | Purpose                                                                                         |
| --------------------------- | -------------------------: | ----------------------------------------------------------------------------------------------- |
| `reticle.baseURL`           | `http://127.0.0.1:8001/v1` | OpenAI-compatible base URL. Reticle appends `/completions`.                                     |
| `reticle.model`             |                      empty | Exact model ID from the server's `/v1/models` response.                                         |
| `reticle.apiKey`            |                      empty | Optional on loopback; required for remote endpoints.                                            |
| `reticle.extraHeaders`      |                       `{}` | Additional string-valued request headers.                                                       |
| `reticle.fimFormat`         |                   `openai` | `openai` sends a separate suffix; `qwen` and `seed` embed their model-native FIM markers.       |
| `reticle.maxLines`          |                        `8` | Maximum lines displayed in one inline completion (1–64).                                        |
| `reticle.maxTokens`         |                      `256` | Maximum generated tokens (1–2048).                                                              |
| `reticle.temperature`       |                        `0` | Sampling temperature (0–2).                                                                     |
| `reticle.debounceMs`        |                      `100` | Automatic-request delay (75–150 ms).                                                            |
| `reticle.enableAutoTrigger` |                     `true` | Enables automatic suggestions.                                                                  |
| `reticle.multiFileContext`  |                    `false` | Opt-in context from relevant files in the same workspace. This sends more code to the endpoint. |
| `reticle.languageAllowlist` |                       `[]` | When non-empty, only listed VS Code language IDs are enabled.                                   |
| `reticle.languageDenylist`  |                       `[]` | Language IDs to disable; deny takes precedence.                                                 |

Reticle requires HTTPS and an API key for non-loopback endpoints. It never logs response bodies from HTTP errors, because providers can reflect credentials or request content.

## Provider guides

- [Ollama](docs/providers/ollama.md) — recommended first setup; its OpenAI compatibility documents `suffix`.
- [Reticle MLX](docs/providers/mlx.md) — signed macOS menu-bar app and model-agnostic MLX-LM service manager.
- [MTPLX](docs/providers/mtplx.md) — managed Apple Silicon service with health, metrics, dashboard, and Qwen PSM transport.
- [llama.cpp](docs/providers/llama-cpp.md) — excellent FIM runtime, with an important `/infill` versus `/v1/completions` caveat.
- [OMLX](docs/providers/omlx.md) — Apple Silicon serving and the archive's fastest Mac-local model result.
- [LM Studio](docs/providers/lm-studio.md) — GUI/headless local server; verify suffix mapping for the exact version and model.
- [Remote hosted provider](docs/providers/remote.md) — HTTPS, key handling, and suffix-support checks.

See the evidence-based [model compatibility table](docs/model-compatibility.md) before choosing a checkpoint.

## Troubleshooting

- **Prose, an explanation, or fenced Markdown:** the model is behaving as chat, not FIM. Select a Base/FIM checkpoint and rerun the litmus. Fence stripping cannot make a model suffix-aware.
- **The model repeats or rewrites the suffix:** the server ignored `suffix` or used the wrong FIM serialization. This model/server pair is not compatible through Reticle's transport.
- **Empty output:** verify the exact model ID with `GET /v1/models`, inspect server logs, increase `reticle.maxTokens`, and rerun the non-streaming probe.
- **Remote configuration error:** use an `https://` base URL and set `reticle.apiKey`. Reticle intentionally rejects insecure remote HTTP.
- **Suggestions are slow only on the first edit:** cold prompt prefill can take seconds. Keep the model loaded; cache-aware servers benefit from Reticle's stable per-model/per-document session header.
- **No suggestion in one language:** check the allowlist and denylist. The denylist wins.
- **Wrong extension's suggestion appears:** temporarily disable Copilot and other inline-completion extensions.

## Development

```bash
npm ci
npm run compile
npm test
npm run lint
```

The live integration test is explicit and loopback-only:

```bash
RETICLE_INTEGRATION=1 \
RETICLE_INTEGRATION_MODEL=roboalchemist/Seed-Coder-8B-Base-MLX-mixed-3-4 \
RETICLE_INTEGRATION_FIM_FORMAT=seed \
npm run test:integration
```

Run the same live path inside a real VS Code Extension Development Host:

```bash
RETICLE_E2E_LIVE=1 \
RETICLE_INTEGRATION_MODEL=mtplx-qwen35-9b-optimized-speed \
npm run test:e2e
```

## License

MIT. The optional context engine is an original lightweight implementation; no third-party context-retrieval code is vendored.
