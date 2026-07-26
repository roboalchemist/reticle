# OMLX

[OMLX](https://github.com/jundot/omlx) is an Apple Silicon server with an OpenAI-compatible base URL (normally `http://127.0.0.1:8000/v1`). The research archive's best Mac-local model result used `mlx-community/Qwen2.5-Coder-1.5B-4bit` with OMLX native FIM.

That benchmark manually validated the model's bare-PSM behavior. Current stock OMLX exposes `/v1/completions`, but its request schema does not map a separate `suffix` field. It is therefore **not directly compatible with Reticle today** without a suffix-to-PSM adapter. The exact Reticle probe below is the gate for any adapted or future version.

## Install and start

Follow the [OMLX installation instructions](https://github.com/jundot/omlx). A typical Homebrew setup is:

```bash
brew tap jundot/omlx https://github.com/jundot/omlx
brew install omlx
omlx serve --model-dir ~/.omlx/models
```

Place a converted Base checkpoint under the configured model directory, then obtain its exact ID:

```bash
curl --silent --show-error http://127.0.0.1:8000/v1/models
```

In the commands below, replace `MODEL_ID` with that response value.

## Exact FIM probe

```bash
curl --silent --show-error http://127.0.0.1:8000/v1/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "MODEL_ID",
    "prompt": "function add(a, b) {\n  return ",
    "suffix": "\n}\n",
    "max_tokens": 32,
    "temperature": 0,
    "stream": false
  }'
```

Proceed only if `choices[0].text` is the bare middle `a + b` (an optional semicolon is fine). Then repeat with `"stream": true` and verify OpenAI-style SSE chunks. If OMLX returns a continuation that ignores the suffix, that server version is not directly compatible with Reticle even though the model itself supports FIM.

## Reticle settings

```jsonc
{
  "reticle.baseURL": "http://127.0.0.1:8000/v1",
  "reticle.model": "MODEL_ID",
}
```

Keep OMLX running and the model loaded for low latency. The archived 283 ms result depended on a warm 3,840-token prefix cache; a cold 4K request took about 2.3 seconds.

After an adapted or future OMLX version passes both probes, run **Reticle: Test Autocomplete Endpoint**. Open a JavaScript file containing the probe function, place the cursor after `return `, run **Reticle: Trigger Inline Completion**, confirm the clean middle appears as ghost text, and press `Tab` to accept it.
