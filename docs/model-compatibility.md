# Model compatibility

Reticle needs two independent capabilities:

1. the checkpoint produces a clean fill-in-the-middle insertion; and
2. the server maps OpenAI `prompt` + `suffix` onto that checkpoint's FIM format.

A benchmark that manually embeds `<|fim_prefix|>` markers proves model behavior, but does not automatically prove that an arbitrary `/v1/completions` server will perform the mapping for Reticle. Always run the [litmus probe](../README.md#the-compatibility-litmus) against the exact model/server pair.

## Validated working paths

| Model and runtime                                                    | Evidence                                                                                                                                       | Reticle transport note                                                                                                                                                                            |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Qwen2.5-Coder 1.5B Base**, Ollama 0.24                             | Fresh-model QA on 2026-07-15 returned exact `a + b;` in JSON and four clean SSE chunks; Reticle's live provider harness passed in 150 ms warm. | Directly compatible. Use the explicit `qwen2.5-coder:1.5b-base` tag.                                                                                                                              |
| **Qwen2.5-Coder 1.5B Base**, 4-bit, OMLX native FIM                  | Best Mac-local archive result: 283 ms cached TTFT p50 at a 3,968-token prompt; 15/15 correct after conservative trimming.                      | Use a server/version that maps `suffix` to Qwen bare PSM. Ollama's `qwen2.5-coder:1.5b-base` documents this mapping and is the simplest first setup.                                              |
| **Qwen3-Coder 30B-A3B Instruct** Q4_K_M, llama.cpp, bare PSM         | Best warm GPU-gateway result: 145 ms cached TTFT p50, 237 ms complete, 19/19 correct after trimming.                                           | The archive manually validated bare PSM. The official ChatML-wrapped recipe produced fences. Confirm that the deployed `/v1/completions` adapter maps `prompt` + `suffix` to bare PSM.            |
| **Qwen3.5 9B** Q4_K_M, llama.cpp bare PSM with 16-token microbatches | 426 ms warm TTFT p50, 11/11 correct after trimming.                                                                                            | Experimental: Qwen3.5 has no official FIM claim, cold latency was 9.4 s, and the result depended on PSM plus same-slot recurrent state. Verify the adapter and keep one slot per active document. |
| **Mellum2 12B-A2.5B**, OMLX native FIM                               | Accurate (9/9 raw at 5K), but 1.44 s cached TTFT.                                                                                              | Functionally viable but slow for always-on ghost text. Confirm `suffix` mapping in the serving version.                                                                                           |

Latency figures compare the archived hardware/runtime configurations, not model quality in the abstract. Cache state is decisive: the Qwen3-Coder 30B path was 11.2 s cold, and Qwen2.5-Coder's 4K request was about 2.3 s cold.

## Validated failures and traps

| Model/path                                           | Observed failure                                                                                                                                                                           | Verdict                                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Qwen3.5 0.8B Base and Instruct**, raw FIM tokens   | Both failed FIM tasks. FIM-looking vocabulary did not imply FIM training.                                                                                                                  | Do not use.                                                                                                          |
| **Qwen3-Coder-Next Instruct** through OpenRouter     | Raw `prompt` + `suffix` ignored the suffix and returned chat prose. Explicit FIM markers returned the right middle wrapped in Markdown fences; fence-forbidding prompts did not repair it. | Do not use through this hosted instruct path. A Base checkpoint behind a purpose-built FIM adapter remains untested. |
| **Qwen3-Coder 30B official ChatML-wrapped FIM**      | Began with a Markdown fence on every archived edit.                                                                                                                                        | Use the validated bare-PSM path instead, with an adapter that maps the fields.                                       |
| Any chat/instruct model that returns prose or fences | Typical text begins with “Here's…” or returns a complete fenced function.                                                                                                                  | Not compatible. Post-processing cannot recover reliable suffix conditioning.                                         |
| Any server that accepts but ignores `suffix`         | Repeats the suffix, rewrites the whole function, or answers conversationally despite HTTP 200.                                                                                             | Not compatible through Reticle until its FIM mapping is fixed.                                                       |

## Why “Base” matters

FIM is a training and serving protocol, not a synonym for “good at code.” Qwen2.5-Coder Base has a documented native bare-PSM recipe. Qwen3-Coder's documented instruct recipe uses ChatML-wrapped PSM, but the archive found bare PSM cleaner in deployed IDE-style serving. Qwen3.5/3.6 make no official FIM claim; only particular experimental or fine-tuned paths worked.

## Test conditions

The Mac-local results were captured on an Apple M3 Pro with 36 GB of unified memory. The GPU-gateway results used two 16 GB NVIDIA GPUs, and the client-observed latency included the network path. Tests used deterministic sampling, concurrency 1, incremental editor-like changes, and persistent prefix caching. These measurements describe specific July 2026 hardware/runtime configurations; they are evidence, not universal performance guarantees.
