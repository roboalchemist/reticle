# Troubleshooting

Start with the health tools closest to the failing component:

1. In Reticle MLX, check the menu-bar state and open **Settings… → Logs**.
2. In VS Code, open the Reticle Activity Bar panel and click **Check health**.
3. Run **Reticle: Test Autocomplete Endpoint** from the Command Palette.
4. Confirm that the configured model ID and FIM format match the selected
   model.

## No suggestion appears

- Confirm that Reticle is enabled and `reticle.enableAutoTrigger` is on.
- Press `Option+\` on macOS or `Ctrl+Alt+Space` on Windows and Linux to force a
  request.
- Open the Reticle panel and verify that the endpoint is reachable.
- Check the language allowlist and denylist. The denylist takes precedence.
- Temporarily disable other inline-completion extensions while testing so
  their providers and keybindings do not obscure Reticle's result.

## Output is prose or fenced Markdown

The checkpoint is behaving as a chat model instead of a fill-in-the-middle
model. Select a Base/FIM checkpoint and run
[model compatibility testing](model-compatibility.md). Post-processing cannot
make a model suffix-aware.

## Output repeats or rewrites existing code

The server probably ignored the suffix or used the wrong FIM serialization.
Confirm `reticle.fimFormat`, then test the exact model/server pair. Reticle
removes safe suffix overlap, but it cannot reliably repair a model that rewrites
the surrounding function.

## Output is empty

- Confirm the exact model ID through `/v1/models`.
- Inspect the Reticle extension log and the selected provider's server log.
- Increase `reticle.maxTokens`.
- Check whether the model emitted only stop tokens or existing suffix text.

## The first suggestion is slow

Cold model loading and prompt prefill can take seconds. Keep the model loaded
and compare subsequent requests. Cache-aware servers benefit from Reticle's
stable per-model, per-document session header.

Reticle MLX exposes time to first token, cold latency, warm latency, total
completion time, and throughput in its **Benchmark** tab.

## A remote endpoint is rejected

Reticle requires HTTPS and an API key for non-loopback endpoints. It
intentionally rejects insecure remote HTTP. Confirm the URL ends at the
provider's OpenAI-compatible `/v1` base and place additional string-valued
headers in `reticle.extraHeaders`.

## Reticle MLX is starting or unhealthy

The app distinguishes a process that is still inside its startup grace period
from one that has stopped or failed its health check. Open **Settings… → Logs**
and export the diagnostic bundle. It includes launchd state, the selected
model, endpoint health, and runtime stdout/stderr.

If a downloaded model cannot start, verify that the Mac has enough available
unified memory and try a smaller preset. See the
[Reticle MLX guide](providers/mlx.md) for service lifecycle and storage details.

## Related guides

- [Configuration](configuration.md)
- [How completion works](how-completion-works.md)
- [Model compatibility testing](model-compatibility.md)
- [Provider setup](providers/README.md)
