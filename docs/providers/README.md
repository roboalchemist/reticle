# Provider setup

Every Reticle provider must expose `POST /v1/completions`, accept `prompt` and `suffix`, return text in `choices[0].text`, and stream OpenAI-style SSE when `stream` is true.

| Provider  | Typical base URL                            | Guide                 |
| --------- | ------------------------------------------- | --------------------- |
| Ollama    | `http://127.0.0.1:11434/v1`                 | [Setup](ollama.md)    |
| llama.cpp | `http://127.0.0.1:8080/v1`                  | [Setup](llama-cpp.md) |
| OMLX      | `http://127.0.0.1:8000/v1`                  | [Setup](omlx.md)      |
| LM Studio | `http://127.0.0.1:1234/v1`                  | [Setup](lm-studio.md) |
| Hosted    | provider-specific HTTPS URL ending in `/v1` | [Setup](remote.md)    |

Run the exact probe in the selected guide before enabling Reticle. Endpoint names alone are insufficient: some servers expose `/v1/completions` but ignore `suffix`, and some coding models answer in chat prose.
