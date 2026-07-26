# Ollama

Ollama is the recommended first setup because its [OpenAI compatibility documentation](https://docs.ollama.com/api/openai-compatibility) explicitly lists `/v1/completions`, streaming, and the `suffix` request field. The `qwen2.5-coder:1.5b-base` tag uses a FIM-trained Base checkpoint; do not substitute the default Instruct tag for this test.

## Install and start

Install [Ollama](https://ollama.com/download), then run:

```bash
ollama pull qwen2.5-coder:1.5b-base
ollama serve
```

If the desktop app already started the service, `ollama serve` may report that port 11434 is in use; that is harmless. Confirm the exact model ID:

```bash
curl --silent --show-error http://127.0.0.1:11434/v1/models
```

## Exact FIM probe

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

`choices[0].text` must be a bare middle such as `a + b`. Then repeat with `"stream": true`.

## Reticle settings

```jsonc
{
  "reticle.baseURL": "http://127.0.0.1:11434/v1",
  "reticle.model": "qwen2.5-coder:1.5b-base",
  "reticle.apiKey": "",
}
```

Run **Reticle: Test Autocomplete Endpoint**. If it reports prose or fenced output, verify that the model name ends in `-base`; `qwen2.5-coder:1.5b` is a different tag.

For the end-to-end check, open a JavaScript file containing the probe function, place the cursor after `return `, run **Reticle: Trigger Inline Completion**, and confirm `a + b;` appears as ghost text. Press `Tab` to accept it. Disable other inline-completion extensions during this check.

For longer prompts, Ollama documents creating a custom `Modelfile` with `PARAMETER num_ctx 16384` (or another appropriate size). Use the new model name in both the probe and Reticle.
