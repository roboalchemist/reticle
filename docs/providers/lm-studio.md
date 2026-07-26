# LM Studio

LM Studio documents an OpenAI-compatible [`POST /v1/completions`](https://lmstudio.ai/docs/developer/openai-compat) endpoint on its local server. Suffix-to-FIM mapping depends on the loaded model and LM Studio version, so the probe is mandatory.

## Load and serve a model

1. In LM Studio, download and load a **Base/FIM** GGUF such as Qwen2.5-Coder 1.5B Base. Avoid an Instruct/chat variant.
2. Open **Developer**, then start the local server. Alternatively:

   ```bash
   lms server start --port 1234
   ```

3. Copy the exact model ID:

   ```bash
   curl --silent --show-error http://127.0.0.1:1234/v1/models
   ```

## Exact FIM probe

Replace `MODEL_ID` below:

```bash
curl --silent --show-error http://127.0.0.1:1234/v1/completions \
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

Do not continue merely because the endpoint returns 200. `choices[0].text` must be a bare insertion such as `a + b`, proving that LM Studio honored the suffix for this checkpoint. Repeat with `"stream": true`.

## Reticle settings

```jsonc
{
  "reticle.baseURL": "http://127.0.0.1:1234/v1",
  "reticle.model": "MODEL_ID",
}
```

Run **Reticle: Test Autocomplete Endpoint**. If LM Studio's server is exposed beyond `127.0.0.1`, enable authentication and TLS at a trusted reverse proxy; Reticle rejects plain HTTP for remote hosts.

For the end-to-end check, open a JavaScript file containing the probe function, place the cursor after `return `, run **Reticle: Trigger Inline Completion**, confirm the clean middle appears as ghost text, and press `Tab` to accept it.
