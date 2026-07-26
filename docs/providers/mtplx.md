# MTPLX

[MTPLX](https://github.com/youssofal/MTPLX) runs Qwen MTP models natively on Apple Silicon. Reticle's managed setup uses the verified 9B speed checkpoint, a loopback-only server, deterministic sampling, and a user LaunchAgent that restarts after crashes and login.

Requirements are Apple Silicon, macOS 14 or newer, and at least 16 GB unified memory. The model download is about 9 GB. Treat 16 GB as a functional validation floor rather than a real-time recommendation: MTPLX warns below 48 GB and performs a dynamic memory preflight, and an M1 with 16 GB remained much slower than a high-memory MacBook Pro even after competing model servers were stopped. Use at least 32 GB for a practical everyday setup.

## Managed install

Install the public Homebrew package, then run the service helper:

```bash
brew install roboalchemist/tap/reticle-mtplx
reticle-mtplx install
```

The helper:

1. installs the current official Homebrew formula;
2. downloads `Youssofal/Qwen3.5-9B-MTPLX-Optimized-Speed`;
3. creates `~/Library/LaunchAgents/io.github.roboalchemist.reticle.mtplx.plist`;
4. starts MTPLX on `127.0.0.1:8000`; and
5. waits until `GET /health` succeeds and runs a Reticle-shaped FIM warmup.

It does not use `sudo`, expose the server to the LAN, or enable forced fan control. It defaults to a 16K context window and Q4 paged KV cache so the verified 9B model can run on memory-constrained Macs without altering the model weights. Set `MTPLX_MODEL`, `MTPLX_PORT`, `MTPLX_PROFILE`, `MTPLX_CONTEXT_WINDOW`, or `MTPLX_KV_QUANTIZATION` before `install` to override the defaults.

To run directly from a source checkout instead, replace `reticle-mtplx` in the examples with `scripts/mtplx-service`.

## Monitor and operate

```bash
reticle-mtplx status
reticle-mtplx health
reticle-mtplx monitor
reticle-mtplx dashboard
reticle-mtplx logs
reticle-mtplx doctor
reticle-mtplx restart
reticle-mtplx stop
reticle-mtplx start
```

`status` gives a compact launchd and health summary. `health` prints the complete server report. `monitor` uses MTPLX's live `/metrics` view, and `dashboard` opens the local dashboard. `doctor` reads the installed LaunchAgent configuration, checks launchd and `/health`, and runs a suffix-dependent FIM request against the configured port. Logs are stored under `~/.mtplx/logs/`.

Custom install settings are remembered from the LaunchAgent. For example, after `MTPLX_PORT=8010 reticle-mtplx install`, later `status`, `doctor`, `monitor`, and lifecycle commands use port 8010 without requiring the environment variable again. An explicitly supplied environment variable still overrides the installed value for that command.

To remove only the managed service:

```bash
reticle-mtplx uninstall
```

Uninstalling preserves MTPLX itself, downloaded models, its session cache, and logs.

## Why `fimFormat` must be `qwen`

MTPLX 2.3.0 exposes OpenAI `POST /v1/completions`, but that endpoint performs plain prompt completion: it accepts an extra `suffix` property without mapping it into the model input. Reticle's `qwen` mode embeds the prefix and suffix with the checkpoint's actual PSM special tokens:

```text
<|fim_prefix|>PREFIX<|fim_suffix|>SUFFIX<|fim_middle|>
```

This is not prompt decoration or a chat instruction; each marker is one registered tokenizer special token.

Verify the exact live path with a suffix-dependent request:

```bash
curl --silent --show-error http://127.0.0.1:8000/v1/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "mtplx-qwen35-9b-optimized-speed",
    "prompt": "<|fim_prefix|>function select(user: User) {\n  const value = user.<|fim_suffix|>;\n  return value;\n}\ninterface User { suffixOnlyIdentifier: string }\n<|fim_middle|>",
    "max_tokens": 32,
    "temperature": 0,
    "stream": false,
    "stop": "\n"
  }'
```

`choices[0].text` must be `suffixOnlyIdentifier`. The identifier exists only after the cursor, so this probe cannot pass through continuation alone.

## Configure Reticle

Use the exact model ID returned by `GET /v1/models`:

```jsonc
{
  "reticle.baseURL": "http://127.0.0.1:8000/v1",
  "reticle.model": "mtplx-qwen35-9b-optimized-speed",
  "reticle.fimFormat": "qwen",
  "reticle.maxTokens": 64,
}
```

Run **Reticle: Test Autocomplete Endpoint**. On the validated Apple M3 Max setup, the live provider test returned the suffix-only identifier in 301 ms and the real VS Code extension-host test returned it in 384 ms after warmup. These are local observations, not a guarantee for other Macs.

Keep `reticle.multiFileContext` off until basic completions work. MTPLX's dashboard can remain open while editing to watch request latency and decode throughput.

## Troubleshooting

- **Service will not start:** run `reticle-mtplx logs`, then `reticle-mtplx doctor`.
- **`fimFormat` is `openai`:** MTPLX ignores the separate suffix and behaves as a continuation server. Set it to `qwen`.
- **Wrong model ID:** use `curl http://127.0.0.1:8000/v1/models`; the served ID differs from the Hugging Face repository name.
- **First request is slow:** `install`, `start`, and `restart` warm both MTPLX and Reticle's FIM request shape. Wait for the command to finish and `reticle-mtplx status` to show a successful warmup before testing.
- **Port 8000 is occupied:** reinstall with a free loopback port, for example `MTPLX_PORT=8010 reticle-mtplx install`, and use the same port in Reticle.
- **Memory preflight fails or latency varies wildly:** stop other local-model servers and large applications, keep the default 16K context and Q4 KV cache, and retry. Do not bypass MTPLX's memory guard.
