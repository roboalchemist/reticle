<p align="center">
  <img src="media/icon.png" width="128" height="128" alt="Reticle logo: code brackets and a completion sparkle">
</p>

<h1 align="center">Reticle + Reticle MLX</h1>

<p align="center">
  <strong>Fast, private code completion on your own endpoint.</strong>
  <br>
  A native Apple Silicon model app and a local-first VS Code extension, designed to work together.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=roboalchemist.reticle"><img alt="VS Code Marketplace version" src="https://img.shields.io/github/v/release/roboalchemist/reticle-mlx?label=VS%20Code&color=6574f7"></a>
  <a href="https://open-vsx.org/extension/roboalchemist/reticle"><img alt="Open VSX version" src="https://img.shields.io/open-vsx/v/roboalchemist/reticle?label=Open%20VSX&color=6574f7"></a>
  <a href="https://github.com/roboalchemist/reticle-mlx/actions/workflows/ci.yml"><img alt="Build status" src="https://github.com/roboalchemist/reticle-mlx/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-ff7869"></a>
</p>

<p align="center">
  <a href="#choose-your-setup"><strong>Get started</strong></a>
  ·
  <a href="#easiest-setup-reticle-mlx--vs-code">Mac app + extension</a>
  ·
  <a href="#use-the-vs-code-extension-with-an-existing-endpoint">Extension only</a>
  ·
  <a href="#provider-and-setup-guides">Provider guides</a>
  ·
  <a href="#documentation">Documentation</a>
</p>

---

Reticle provides true fill-in-the-middle (FIM) ghost text in VS Code. It sends
the code before and after your cursor to an OpenAI-compatible completion
endpoint, then offers anything from a single identifier to a bounded
multi-line edit. Press `Tab` once to accept the suggestion.

The project has two primary parts:

- **Reticle MLX** is the native menu-bar app for running, switching,
  benchmarking, and monitoring completion models on an Apple Silicon Mac.
- **Reticle** is the VS Code extension that connects your editor to Reticle MLX
  or another compatible `POST /v1/completions` endpoint.

There is no hosted Reticle account and no telemetry. With Reticle MLX, model
traffic stays on your Mac over a loopback-only service.

## Choose your setup

| If you…                                                      | Start here                                                                          |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Use an Apple Silicon Mac and want the easiest complete setup | Install **Reticle MLX**, then let the app install and verify the VS Code extension. |
| Already run a compatible local or hosted completion endpoint | Install the **Reticle VS Code extension** and connect it to that endpoint.          |

## Easiest setup: Reticle MLX + VS Code

Reticle MLX is the recommended path for Apple Silicon MacBooks and desktops. It
handles the model runtime, downloads, service lifecycle, logs, health checks,
benchmarking, and VS Code setup without requiring a terminal after
installation.

1. Install and open the signed, notarized Mac app:

   ```bash
   brew install --cask roboalchemist/tap/reticle-mlx
   open -g -a "Reticle MLX"
   ```

   You can also download the DMG or ZIP from the
   [latest GitHub release](https://github.com/roboalchemist/reticle-mlx/releases/latest).

2. Open **Settings… → Models**, download a model, and click **Select**. The
   recommended model appears first; lighter, faster, and larger alternatives
   are listed below it.

3. Open **VS Code Setup**, click **Install VS Code Extension**, then run
   **VS Code Doctor**. The doctor verifies the installed extension, endpoint,
   selected model, FIM format, and a real suffix-dependent completion.

4. Open a code file in VS Code and start typing. Reticle suggests automatically;
   press `Tab` to accept. Use `Option+\` to request a suggestion immediately.

The menu-bar app distinguishes starting, healthy, stopped, and unhealthy
services. Its settings include model downloads and selection, a custom-model
path, performance benchmarks, VS Code integration, copyable/exportable logs,
and launch-at-login.

[Read the complete Reticle MLX guide →](docs/providers/mlx.md)

## Use the VS Code extension with an existing endpoint

If you already have a compatible endpoint, install the extension directly:

```bash
code --install-extension roboalchemist.reticle
```

It is also available from
[Open VSX](https://open-vsx.org/extension/roboalchemist/reticle) and as a VSIX
on the [latest GitHub release](https://github.com/roboalchemist/reticle-mlx/releases/latest).

Open the Reticle target in the VS Code Activity Bar, then:

1. Enter the endpoint base URL.
2. Choose a model reported by `/v1/models`, or enter its ID manually.
3. Select the matching FIM format.
4. Save, click **Check health**, and use **Try in editor**.

The panel also exposes autocomplete state and live extension logs. Advanced
options remain available through **Open all settings**.

[Read the configuration guide →](docs/configuration.md)

## What you get

| Reticle MLX for macOS                             | Reticle for VS Code                                          |
| ------------------------------------------------- | ------------------------------------------------------------ |
| Downloaded-model catalog with one-click selection | Automatic single- and multi-line ghost text                  |
| MLX-LM and MTPLX runtime management               | Whole-suggestion acceptance with one `Tab`                   |
| Starting/healthy/unhealthy service states         | Manual completion with `Option+\` on macOS                   |
| Cold, warm, TTFT, and throughput benchmarks       | OpenAI, Qwen, Seed-Coder, and Codestral FIM transports       |
| Resizable activity and copyable/exportable logs   | Endpoint health, downloaded-model picker, settings, and logs |
| Signed Sparkle updates and launch-at-login        | Optional multi-file context with explicit privacy controls   |

## Provider and setup guides

Reticle MLX is the easiest Mac setup, but the extension can use any compatible
provider:

- [Reticle MLX](docs/providers/mlx.md)
- [MTPLX](docs/providers/mtplx.md)
- [Ollama](docs/providers/ollama.md)
- [llama.cpp](docs/providers/llama-cpp.md)
- [OMLX](docs/providers/omlx.md)
- [LM Studio](docs/providers/lm-studio.md)
- [Remote hosted endpoint](docs/providers/remote.md)

A server can return HTTP 200 while ignoring the suffix or wrapping the answer
in chat prose. Verify the exact model and server together before relying on it:

[Run model compatibility testing →](docs/model-compatibility.md#model-compatibility-testing)

## How completion works

Reticle connects directly to an OpenAI-compatible `POST /v1/completions`
endpoint. Depending on the selected transport, it sends a separate OpenAI
`suffix`, Qwen prefix-suffix-middle markers, Seed-Coder's
suffix-prefix-middle format, or Codestral FIM tokens.

Chat-only models are not compatible merely because their server exposes an
OpenAI-shaped API. A compatible model must produce a clean insertion that
respects both sides of the cursor.

Suggestions trigger after a short typing pause. After you accept one, Reticle
waits for your next edit before automatically suggesting again. To validate
Reticle by itself, temporarily disable other inline-completion extensions so
their ghost text is not mistaken for Reticle's.

## Documentation

- [Configuration](docs/configuration.md)
- [Provider setup](docs/providers/README.md)
- [Model compatibility testing and validated models](docs/model-compatibility.md)
- [Reticle MLX for macOS](docs/providers/mlx.md)
- [Development](docs/development.md)
- [Releasing](docs/releasing.md)
- [Changelog](CHANGELOG.md)

## Troubleshooting

- **Prose, explanations, or fenced Markdown:** use a Base/FIM checkpoint and
  run model compatibility testing. Post-processing cannot make a model
  suffix-aware.
- **Repeated or rewritten suffix:** the server ignored the suffix or used the
  wrong FIM serialization.
- **Empty output:** confirm the exact ID through `/v1/models`, inspect the
  provider logs, and increase `reticle.maxTokens`.
- **Remote configuration error:** use HTTPS and provide an API key. Reticle
  intentionally rejects insecure remote HTTP.
- **Slow first suggestion:** cold model loading and prompt prefill can take
  seconds; subsequent cache-aware requests should be faster.
- **No suggestion in one language:** check the language allowlist and denylist.

See the [configuration guide](docs/configuration.md) and the selected
[provider guide](docs/providers/README.md) for detailed diagnostics.

## License

MIT. The optional context engine is an original lightweight implementation; no
third-party context-retrieval code is vendored.
