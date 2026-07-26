# Remote hosted provider

A hosted provider works only when it offers the legacy OpenAI-compatible **text completions** endpoint and actually honors `suffix`. Chat Completions (`/v1/chat/completions`) and Responses (`/v1/responses`) are different APIs and cannot be used as Reticle's base URL.

The Qwen3-Coder-Next/OpenRouter archive result is the cautionary example: `/v1/completions` returned HTTP 200, but the hosted model ignored `suffix` and answered in prose. Never infer compatibility from a provider's model name or status code.

## Discover and probe

```bash
export RETICLE_BASE_URL='https://provider.example/v1'
export RETICLE_MODEL='provider/model-id'
export RETICLE_API_KEY='replace-me'

curl --silent --show-error "$RETICLE_BASE_URL/models" \
  -H "Authorization: Bearer $RETICLE_API_KEY"

curl --silent --show-error "$RETICLE_BASE_URL/completions" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $RETICLE_API_KEY" \
  -d "{
    \"model\": \"$RETICLE_MODEL\",
    \"prompt\": \"function add(a, b) {\\n  return \",
    \"suffix\": \"\\n}\\n\",
    \"max_tokens\": 32,
    \"temperature\": 0,
    \"stream\": false
  }"
```

The response must contain only a middle insertion such as `a + b` in `choices[0].text`. Confirm the provider's documentation lists `suffix` as a supported parameter, then repeat with `"stream": true`.

## Reticle settings

```jsonc
{
  "reticle.baseURL": "https://provider.example/v1",
  "reticle.model": "provider/model-id",
  "reticle.apiKey": "your-key",
}
```

Reticle requires HTTPS and a non-empty key for every non-loopback URL. Prefer entering the key in user settings rather than a repository's `.vscode/settings.json`; workspace settings can be committed accidentally. Additional provider headers belong in `reticle.extraHeaders`.

Run **Reticle: Test Autocomplete Endpoint**. Then open a JavaScript file containing the probe function, place the cursor after `return `, run **Reticle: Trigger Inline Completion**, confirm the clean middle appears as ghost text, and press `Tab` to accept it.

## Security checklist

- Understand that the prompt and suffix contain source code from the active document.
- Leave `reticle.multiFileContext` off unless the provider is approved to receive more workspace code.
- Use a narrowly scoped key and rotate it if it is exposed.
- Do not put credentials in the URL, query string, or fragment; Reticle rejects those base URLs.
- Verify retention/training policies with the provider. Reticle itself records no telemetry, but it cannot control the endpoint.
