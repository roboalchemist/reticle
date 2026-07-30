# Reticle configuration

Reticle can be configured from its Activity Bar panel or through VS Code's
normal Settings UI. The panel covers the settings most people change and
provides endpoint health, model discovery, an editor completion trigger, and
logs in one place.

## Configure from the Reticle panel

1. Open the Reticle target in the VS Code Activity Bar.
2. Set the endpoint **Base URL**.
3. Choose an **Available model** reported by `/v1/models`, or enter an ID
   manually.
4. Select the model's **FIM format**.
5. Click **Save settings**, then **Check health**.
6. Open a code editor and click **Try in editor**.

Reticle MLX reports MLX models that are already downloaded in the local
Hugging Face cache. Selecting one lets MLX-LM load it on demand. The standard
`/v1/models` response does not describe FIM compatibility, so the format
remains an explicit setting.

Use **Open all settings** for API keys, custom headers, language filters, and
the complete configuration surface.

## Settings reference

| Setting                     |                    Default | Purpose                                                                                                                   |
| --------------------------- | -------------------------: | ------------------------------------------------------------------------------------------------------------------------- |
| `reticle.baseURL`           | `http://127.0.0.1:8001/v1` | OpenAI-compatible base URL. Reticle appends `/completions`.                                                               |
| `reticle.model`             |                      empty | Exact request model ID. Reticle MLX normally uses `default_model`; its MLX-LM endpoint also accepts downloaded model IDs. |
| `reticle.apiKey`            |                      empty | Optional on loopback; required for remote endpoints.                                                                      |
| `reticle.extraHeaders`      |                       `{}` | Additional string-valued request headers.                                                                                 |
| `reticle.fimFormat`         |                   `openai` | FIM serialization: `openai`, `qwen`, `seed`, or `codestral`.                                                              |
| `reticle.maxLines`          |                        `8` | Maximum lines displayed in one inline completion (1–64).                                                                  |
| `reticle.maxTokens`         |                      `256` | Maximum generated tokens (1–2048).                                                                                        |
| `reticle.temperature`       |                        `0` | Sampling temperature (0–2).                                                                                               |
| `reticle.debounceMs`        |                      `100` | Delay before an automatic request (75–150 ms).                                                                            |
| `reticle.enableAutoTrigger` |                     `true` | Enable suggestions after a short typing pause.                                                                            |
| `reticle.multiFileContext`  |                    `false` | Include relevant context from other open files in the same workspace.                                                     |
| `reticle.languageAllowlist` |                       `[]` | When non-empty, enable only these VS Code language IDs.                                                                   |
| `reticle.languageDenylist`  |                       `[]` | Disable these language IDs; deny takes precedence.                                                                        |

VS Code applies settings at user, workspace, or workspace-folder scope.
Reticle preserves the scope where a setting is already defined.

## FIM formats

The format must match the model and serving adapter:

| Value       | Behavior                                                | Typical use                                                                         |
| ----------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `openai`    | Sends separate `prompt` and `suffix` fields.            | Ollama or another server that maps the OpenAI suffix onto the model's FIM template. |
| `qwen`      | Embeds Qwen prefix-suffix-middle markers in the prompt. | Qwen2.5-Coder, validated Zeta builds, and MTPLX.                                    |
| `seed`      | Uses Seed-Coder's suffix-prefix-middle serialization.   | Seed-Coder Base models.                                                             |
| `codestral` | Uses Codestral's native FIM tokens.                     | Codestral models with a compatible tokenizer.                                       |

Do not infer compatibility from the model name alone. Run
[model compatibility testing](model-compatibility.md#model-compatibility-testing)
against the exact model and server pair.

## Common examples

### Reticle MLX

The Mac app can install these settings automatically from **VS Code Setup**:

```jsonc
{
  "reticle.baseURL": "http://127.0.0.1:8001/v1",
  "reticle.model": "default_model",
  "reticle.fimFormat": "qwen",
  "reticle.temperature": 0,
  "reticle.maxTokens": 64,
  "reticle.maxLines": 8,
}
```

The selected preset determines the correct format. Seed-Coder uses `seed`;
Zeta and Qwen use `qwen`; Codestral uses `codestral`.

### Remote HTTPS endpoint

```jsonc
{
  "reticle.baseURL": "https://api.example.com/v1",
  "reticle.model": "provider/model-id",
  "reticle.apiKey": "your-api-key",
  "reticle.fimFormat": "openai",
}
```

Reticle rejects non-loopback HTTP endpoints. Remote endpoints must use HTTPS
and an API key.

### Custom headers

```jsonc
{
  "reticle.extraHeaders": {
    "X-Workspace": "editor",
    "X-Provider-Version": "2026-07",
  },
}
```

Header values must be strings. Do not duplicate `Authorization`; use
`reticle.apiKey`.

## Triggering and accepting suggestions

- Suggestions trigger automatically after `reticle.debounceMs`.
- Press `Option+\` on macOS to force a suggestion.
- Press `Ctrl+Alt+Space` on Windows or Linux.
- Press `Tab` to accept the complete single- or multi-line suggestion.

After accepting a Reticle suggestion, automatic completion waits for your next
edit. This prevents the accepted block from immediately being suggested again.

## Multi-file context and privacy

`reticle.multiFileContext` is off by default. When enabled, Reticle may add
relevant snippets from other open files in the same workspace. That improves
repository-aware completions but sends more source code to the configured
endpoint.

For a loopback Reticle MLX service, the request stays on the Mac. For a remote
endpoint, review the provider's data-handling policy before enabling this
option.

## Security behavior

- Remote endpoints require HTTPS and an API key.
- Loopback endpoints may omit the key.
- API keys and extra headers are sent only to the configured endpoint.
- HTTP error bodies are not logged because a provider can reflect credentials
  or request content.
- Reticle has no hosted account and emits no product telemetry.

## Related guides

- [Provider setup](providers/README.md)
- [Model compatibility testing](model-compatibility.md)
- [Reticle MLX](providers/mlx.md)
- [Troubleshooting](troubleshooting.md)
