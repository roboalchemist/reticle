# MTPLX

[MTPLX](https://github.com/youssofal/MTPLX) runs Qwen MTP models natively on Apple Silicon. Reticle's managed setup uses the verified 9B speed checkpoint, a loopback-only server, deterministic sampling, and a user LaunchAgent that restarts after crashes and login.

Requirements are Apple Silicon, macOS 14 or newer, and at least 16 GB unified memory. The model download is about 9 GB.

## Managed install

Clone Reticle, then run the service helper:

```bash
git clone https://github.com/roboalchemist/reticle.git
cd reticle
scripts/mtplx-service install
```

The helper:

1. installs the current official Homebrew formula;
2. downloads `Youssofal/Qwen3.5-9B-MTPLX-Optimized-Speed`;
3. creates `~/Library/LaunchAgents/io.github.roboalchemist.reticle.mtplx.plist`;
4. starts MTPLX on `127.0.0.1:8000`; and
5. waits until `GET /health` succeeds.

It does not use `sudo`, expose the server to the LAN, or enable forced fan control. Set `MTPLX_MODEL`, `MTPLX_PORT`, or `MTPLX_PROFILE` before `install` to override the defaults.

## Monitor and operate

```bash
scripts/mtplx-service status
scripts/mtplx-service health
scripts/mtplx-service monitor
scripts/mtplx-service dashboard
scripts/mtplx-service logs
scripts/mtplx-service restart
scripts/mtplx-service stop
scripts/mtplx-service start
```

`status` gives a compact launchd and health summary. `health` prints the complete server report. `monitor` uses MTPLX's live `/metrics` view, and `dashboard` opens the local dashboard. Logs are stored under `~/.mtplx/logs/`.

To remove only the managed service:

```bash
scripts/mtplx-service uninstall
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

- **Service will not start:** run `scripts/mtplx-service logs`, then `/opt/homebrew/bin/mtplx doctor --deep`.
- **`fimFormat` is `openai`:** MTPLX ignores the separate suffix and behaves as a continuation server. Set it to `qwen`.
- **Wrong model ID:** use `curl http://127.0.0.1:8000/v1/models`; the served ID differs from the Hugging Face repository name.
- **First request is slow:** wait for `scripts/mtplx-service status` to show a successful warmup before testing.
- **Port 8000 is occupied:** reinstall with a free loopback port, for example `MTPLX_PORT=8010 scripts/mtplx-service install`, and use the same port in Reticle.
