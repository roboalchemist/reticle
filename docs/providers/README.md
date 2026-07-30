# Provider setup

Every Reticle provider must expose `POST /v1/completions`, return text in `choices[0].text`, and stream OpenAI-style SSE when `stream` is true. It must honor separate `prompt` and `suffix` fields (`reticle.fimFormat: "openai"`) or accept the configured model-native markers: Qwen PSM (`"qwen"`) or Seed-Coder SPM (`"seed"`).

| Provider    | Typical base URL                            | Guide                 | FIM format       |
| ----------- | ------------------------------------------- | --------------------- | ---------------- |
| Reticle MLX | `http://127.0.0.1:8001/v1`                  | [Setup](mlx.md)       | preset-dependent |
| MTPLX       | `http://127.0.0.1:8000/v1`                  | [Setup](mtplx.md)     | `qwen`           |
| Ollama      | `http://127.0.0.1:11434/v1`                 | [Setup](ollama.md)    | `openai`         |
| llama.cpp   | `http://127.0.0.1:8080/v1`                  | [Setup](llama-cpp.md) | adapter          |
| OMLX        | `http://127.0.0.1:8000/v1`                  | [Setup](omlx.md)      | adapter          |
| LM Studio   | `http://127.0.0.1:1234/v1`                  | [Setup](lm-studio.md) | verify           |
| Hosted      | provider-specific HTTPS URL ending in `/v1` | [Setup](remote.md)    | verify           |

Run [model compatibility testing](../model-compatibility.md#model-compatibility-testing)
before enabling Reticle. Endpoint names alone are insufficient: some servers
expose `/v1/completions` but ignore `suffix`, and some coding models answer in
chat prose.
