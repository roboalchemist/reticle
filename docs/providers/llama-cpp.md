# llama.cpp

[`llama-server`](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) exposes OpenAI-compatible `/v1/completions` and a separate native `/infill` API. Reticle calls only `/v1/completions`; your llama.cpp build or adapter must map its `suffix` field to the model's FIM tokens. A working `/infill` request alone does not prove Reticle compatibility.

Current stock llama.cpp documents suffix-aware code completion only on `/infill` (`input_prefix` + `input_suffix`); its OpenAI `/v1/completions` path is ordinary prompt completion. Therefore a stock server is **not directly compatible with Reticle today**. The steps below describe the server side of a deployment that also includes a prompt+suffix-to-PSM adapter.

## Start a FIM checkpoint

Use a Base/FIM GGUF such as Qwen2.5-Coder 1.5B Base:

```bash
llama-server \
  --model /path/to/Qwen2.5-Coder-1.5B-Base-Q4_K_M.gguf \
  --alias qwen2.5-coder-1.5b-base \
  --host 127.0.0.1 \
  --port 8080 \
  --ctx-size 8192
```

Confirm the reported alias:

```bash
curl --silent --show-error http://127.0.0.1:8080/v1/models
```

## Exact FIM probe

```bash
curl --silent --show-error http://127.0.0.1:8080/v1/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen2.5-coder-1.5b-base",
    "prompt": "function add(a, b) {\n  return ",
    "suffix": "\n}\n",
    "max_tokens": 32,
    "temperature": 0,
    "stream": false
  }'
```

Proceed only if `choices[0].text` is a bare insertion such as `a + b`. Then repeat the probe with `"stream": true` and verify OpenAI-style SSE chunks. On stock llama.cpp this probe is expected to need the adapter described above. If the suffix is repeated or ignored, do not enable Reticle; changing its base URL to `/infill` will not work because the request shapes differ.

## Reticle settings

```jsonc
{
  "reticle.baseURL": "http://127.0.0.1:8080/v1",
  "reticle.model": "qwen2.5-coder-1.5b-base",
}
```

The archive's fastest GPU-gateway result used Qwen3-Coder-30B-A3B with **bare PSM**, not its official ChatML wrapper. That deployment was runtime-specific; do not assume any Qwen3-Coder GGUF works until the exact probe passes.

After both probes pass, run **Reticle: Test Autocomplete Endpoint**. Open a JavaScript file containing the probe function, place the cursor after `return `, run **Reticle: Trigger Inline Completion**, confirm the clean middle appears as ghost text, and press `Tab` to accept it.
