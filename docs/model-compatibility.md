# Model compatibility testing

Reticle needs two independent capabilities:

1. the checkpoint produces a clean fill-in-the-middle insertion; and
2. the server maps OpenAI `prompt` + `suffix` onto that checkpoint's FIM format.

A benchmark that manually embeds `<|fim_prefix|>` markers proves model
behavior, but does not automatically prove that an arbitrary
`/v1/completions` server will perform the mapping for Reticle. Always test the
exact model, server, and FIM format together.

## Run the test

The easiest test is **Reticle: Test Autocomplete Endpoint** from the VS Code
Command Palette. It sends a fixed suffix-dependent request and distinguishes a
clean insertion from a rewritten function, repeated suffix, chat prose, or
Markdown fence.

To inspect the raw response from a server that maps separate OpenAI `prompt`
and `suffix` fields, send the equivalent non-streaming request yourself. Change
the URL, model ID, and authorization required by the selected provider guide:

```bash
curl --silent --show-error https://HOST/v1/completions \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "MODEL_ID",
    "prompt": "function add(a, b) {\n  return ",
    "suffix": "\n}\n",
    "max_tokens": 32,
    "temperature": 0,
    "stream": false
  }'
```

A compatible response contains a bare insertion in `choices[0].text`, such as
`a + b`, without the suffix, a rewritten function, an explanation, or a
Markdown fence. Once that passes, repeat with `"stream": true`; Reticle uses the
streaming path during normal completion.

An HTTP 200 proves only that the server accepted the JSON. Some servers silently
ignore `suffix`, and some coding models still answer as chat. Treat the
model/server pair as compatible only when the output depends on both the prefix
and suffix.

For Reticle's built-in test, configure the matching transport first:

| Model family                                       | `reticle.fimFormat` |
| -------------------------------------------------- | ------------------- |
| Server maps separate `prompt` + `suffix` correctly | `openai`            |
| Qwen2.5-Coder, validated Zeta builds, MTPLX        | `qwen`              |
| Seed-Coder                                         | `seed`              |
| Zeta 2.1                                           | `zeta`              |
| Codestral                                          | `codestral`         |

See the matching [provider setup guide](providers/README.md) for endpoint-
specific preparation and caveats.

## Validated working paths

| Model and runtime                                                    | Evidence                                                                                                                                                                                                                                                                        | Reticle transport note                                                                                                                                                                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Seed-Coder 8B Base**, MLX mixed 3/4-bit                            | On a 128 GB M3 Max: 93.2 tok/s decode, 284 ms uncached TTFT, and 134–146 ms end-to-end for incrementally cached identifier edits. Eight additional multi-language FIM probes were valid.                                                                                        | Use `reticle.fimFormat: "seed"` with the managed loopback MLX-LM service. The quantized model is 3.6 GB and averages 3.699 bits/weight.                                                                             |
| **Zeta 2.1**, 4-bit MLX-LM                                           | The MLX conversion reproduces the official upstream multi-region sample. Reticle's adapter serializes the cursor line as marker region 1, stops at marker 2, extracts the rewrite, and removes copied suffix lines before presenting a standard VS Code replacement suggestion. | Use `reticle.fimFormat: "zeta"` and `default_model`. Zeta 2.1 remains an edit-prediction model rather than a base FIM checkpoint, so richer file and edit context materially affects whether it proposes a rewrite. |
| **Zeta 7B**, 4-bit MLX-LM                                            | Passed the suffix-only Qwen FIM doctor. Across all 33 public Zeta edit-prediction eval cases, it reached 15 exact outputs and 0.903 mean similarity at about 83 tok/s decode and 4.8 GB peak memory on a 128 GB M3 Max.                                                         | Use `reticle.fimFormat: "qwen"` and `default_model`. The 8-bit build tied the exact score and matched 26/33 outputs but decoded at about 46 tok/s with 8.5 GB peak memory, so 4-bit is the interactive default.     |
| **Qwen3.5 9B MTPLX Optimized Speed**, MTPLX 2.3.0                    | Suffix-only identifier returned in 301 ms through the live provider harness and 384 ms through a real VS Code extension host on 2026-07-26.                                                                                                                                     | Validated with `reticle.fimFormat: "qwen"`. MTPLX's completions endpoint ignores a separate suffix, so native Qwen PSM serialization is required.                                                                   |
| **Qwen2.5-Coder 1.5B Base**, 4-bit MLX-LM                            | Downloaded and passed the managed suffix-dependent FIM doctor on a 128 GB M3 Max on 2026-07-27.                                                                                                                                                                                 | Use `reticle.fimFormat: "qwen"` and the managed service's `default_model` alias. This is the lowest-memory and lowest-latency app preset.                                                                           |
| **Qwen2.5-Coder 3B Base**, 4-bit MLX-LM                              | Downloaded and passed the managed suffix-dependent FIM doctor on a 128 GB M3 Max on 2026-07-27.                                                                                                                                                                                 | Use `reticle.fimFormat: "qwen"` and `default_model`. The Base checkpoint replaces the old, inappropriate Instruct preset.                                                                                           |
| **Codestral 22B v0.1**, 4-bit MLX-LM                                 | Loaded and returned the exact suffix-only identifier through Reticle's official-v3-tokenizer overlay on a 128 GB M3 Max on 2026-07-27.                                                                                                                                          | Use `reticle.fimFormat: "codestral"` and `default_model`. The source conversion's old tokenizer does not expose the FIM controls correctly; the app prepares a no-copy tokenizer overlay.                           |
| **Qwen2.5-Coder 1.5B Base**, Ollama 0.24                             | Fresh-model QA on 2026-07-15 returned exact `a + b;` in JSON and four clean SSE chunks; Reticle's live provider harness passed in 150 ms warm.                                                                                                                                  | Directly compatible. Use the explicit `qwen2.5-coder:1.5b-base` tag.                                                                                                                                                |
| **Qwen2.5-Coder 1.5B Base**, 4-bit, OMLX native FIM                  | Best Mac-local archive result: 283 ms cached TTFT p50 at a 3,968-token prompt; 15/15 correct after conservative trimming.                                                                                                                                                       | Use a server/version that maps `suffix` to Qwen bare PSM. Ollama's `qwen2.5-coder:1.5b-base` documents this mapping and is the simplest first setup.                                                                |
| **Qwen3-Coder 30B-A3B Instruct** Q4_K_M, llama.cpp, bare PSM         | Best warm GPU-gateway result: 145 ms cached TTFT p50, 237 ms complete, 19/19 correct after trimming.                                                                                                                                                                            | The archive manually validated bare PSM. The official ChatML-wrapped recipe produced fences. Confirm that the deployed `/v1/completions` adapter maps `prompt` + `suffix` to bare PSM.                              |
| **Qwen3.5 9B** Q4_K_M, llama.cpp bare PSM with 16-token microbatches | 426 ms warm TTFT p50, 11/11 correct after trimming.                                                                                                                                                                                                                             | Experimental: Qwen3.5 has no official FIM claim, cold latency was 9.4 s, and the result depended on PSM plus same-slot recurrent state. Verify the adapter and keep one slot per active document.                   |
| **Mellum2 12B-A2.5B**, OMLX native FIM                               | Accurate (9/9 raw at 5K), but 1.44 s cached TTFT.                                                                                                                                                                                                                               | Functionally viable but slow for always-on ghost text. Confirm `suffix` mapping in the serving version.                                                                                                             |

Latency figures compare the archived hardware/runtime configurations, not model quality in the abstract. Cache state is decisive: Seed-Coder's same-machine 133-token uncached TTFT was 284 ms before incremental reuse, the Qwen3-Coder 30B path was 11.2 s cold, and Qwen2.5-Coder's 4K request was about 2.3 s cold.

## Validated failures and traps

| Model/path                                           | Observed failure                                                                                                                                                                           | Verdict                                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Qwen3.5 0.8B Base and Instruct**, raw FIM tokens   | Both failed FIM tasks. FIM-looking vocabulary did not imply FIM training.                                                                                                                  | Do not use.                                                                                                          |
| **Qwen3-Coder-Next Instruct** through OpenRouter     | Raw `prompt` + `suffix` ignored the suffix and returned chat prose. Explicit FIM markers returned the right middle wrapped in Markdown fences; fence-forbidding prompts did not repair it. | Do not use through this hosted instruct path. A Base checkpoint behind a purpose-built FIM adapter remains untested. |
| **Qwen3-Coder 30B official ChatML-wrapped FIM**      | Began with a Markdown fence on every archived edit.                                                                                                                                        | Use the validated bare-PSM path instead, with an adapter that maps the fields.                                       |
| Any chat/instruct model that returns prose or fences | Typical text begins with “Here's…” or returns a complete fenced function.                                                                                                                  | Not compatible. Post-processing cannot recover reliable suffix conditioning.                                         |
| Any server that accepts but ignores `suffix`         | Repeats the suffix, rewrites the whole function, or answers conversationally despite HTTP 200.                                                                                             | Not compatible through Reticle until its FIM mapping is fixed.                                                       |

## Why “Base” matters

FIM is a training and serving protocol, not a synonym for “good at code.” Qwen2.5-Coder Base has a documented native bare-PSM recipe. Zeta's primary training target is a larger editable-region rewrite protocol, but its retained Qwen PSM path was validated separately before being exposed as a Reticle preset. Qwen3-Coder's documented instruct recipe uses ChatML-wrapped PSM, but the archive found bare PSM cleaner in deployed IDE-style serving. Qwen3.5/3.6 make no official FIM claim; only particular experimental or fine-tuned paths worked.

## Test conditions

The archived Mac-local results were captured on an Apple M3 Pro with 36 GB of unified memory; the Seed-Coder trial used a 128 GB M3 Max. The GPU-gateway results used two 16 GB NVIDIA GPUs, and the client-observed latency included the network path. Tests used deterministic sampling, concurrency 1, incremental editor-like changes, and persistent prefix caching. These measurements describe specific July 2026 hardware/runtime configurations; they are evidence, not universal performance guarantees.
