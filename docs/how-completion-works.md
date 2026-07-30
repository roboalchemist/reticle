# How completion works

Reticle provides inline tab completion by asking a code model what belongs at
the cursor. Unlike a chat request, it includes code from both sides of the
cursor so the insertion can fit the surrounding file.

## Request lifecycle

1. Reticle waits briefly after an edit, or starts immediately when you press
   `Option+\` on macOS or `Ctrl+Alt+Space` on Windows and Linux.
2. It gathers bounded prefix and suffix context from the active document.
3. If multi-file context is enabled, it adds relevant snippets from other open
   files in the workspace.
4. It serializes that context for the configured model family and streams a
   completion from `POST /v1/completions`.
5. It removes unsafe overlap, repeated suffix text, chat prose, and output
   beyond the configured line limit.
6. VS Code displays the remaining insertion as ghost text. Press `Tab` to
   accept the complete single- or multi-line suggestion.

After accepting a suggestion, Reticle waits for your next edit before
automatically requesting another one. This prevents an accepted block from
immediately being offered again.

## Fill-in-the-middle transports

Different model families represent the cursor position differently:

| Format      | Transport                                                          |
| ----------- | ------------------------------------------------------------------ |
| `openai`    | Sends separate `prompt` and `suffix` fields for the server to map. |
| `qwen`      | Embeds Qwen prefix-suffix-middle markers in the prompt.            |
| `seed`      | Uses Seed-Coder's suffix-prefix-middle serialization.              |
| `codestral` | Uses Codestral's native fill-in-the-middle tokens.                 |

The endpoint shape alone does not prove compatibility. A chat-only model can
accept `POST /v1/completions` while ignoring the suffix or returning prose.
Use [model compatibility testing](model-compatibility.md) with the exact model,
server, and format together.

## Locality and privacy

With Reticle MLX, completion requests travel only between VS Code and a
loopback service on your Mac. Reticle has no hosted account or product
telemetry. Model downloads are user-initiated, and Sparkle performs the app's
minimal background update check.

If you configure a remote provider, the same code context is sent to that
provider instead. Multi-file context is disabled by default because enabling it
can include more workspace code in each request.

## Related guides

- [Configuration](configuration.md)
- [Model compatibility testing](model-compatibility.md)
- [Provider setup](providers/README.md)
- [Troubleshooting](troubleshooting.md)
