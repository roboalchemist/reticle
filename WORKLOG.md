# Worklog

## 2026-07-27 — Idempotent registry retries

- A post-release Open VSX retry correctly found that 0.5.0 was already published, but `ovsx` returned a failure status and left a misleading red workflow run.
- Check each registry's exact version endpoint before publishing. Existing immutable versions now produce a successful no-op, while missing versions continue through the credential and publication path.

## 2026-07-27 — Seed-Coder MLX backend research and integration

- Searched Hugging Face and upstream runtime work for Seed-Coder 8B Base MLX, Core ML/ANE, EAGLE, EAGLE3, Medusa, MTP, and draft-model artifacts. No public Seed-specific speculative head, compatible small draft, or ANE artifact was available.
- Benchmarked uniform 4-bit MLX, locally converted mixed 3/4-bit and mixed 4/6-bit MLX, GGUF Q4_K_M, 4-bit KV cache, skip-logsumexp experiments, and llama.cpp N-gram speculation on a 128 GB M3 Max.
- Selected MLX-LM's `mixed_3_4` recipe: 93.2 tok/s versus 79.5 tok/s for uniform 4-bit MLX and 65.8 tok/s for GGUF Q4_K_M. Incremental MLX prompt caching reduced complete identifier requests to 134–146 ms while reusing 34–35 of 36–37 prompt tokens.
- Published the tested MIT-licensed derivative as `roboalchemist/Seed-Coder-8B-Base-MLX-mixed-3-4` with upstream attribution, the exact conversion recipe, benchmark conditions, and limitations.
- Added Seed's suffix-prefix-middle transport to Reticle and a loopback-only managed MLX-LM LaunchAgent helper with isolated dependencies, bounded prompt caches, warmup, status, monitoring, logs, lifecycle commands, and a suffix-dependent doctor probe.
- The first clean-environment install exposed that MLX-LM 0.31.1's permissive dependency allowed MLX 0.32.0, which returned healthy and then failed in the generation thread with `There is no Stream(gpu, 0) in current thread`. Pin the benchmarked MLX 0.30.5 pair and have `doctor` verify both installed versions; a green `/health` response alone is insufficient.
- Avoided 4-bit KV cache and fresh-edit N-gram speculation because both regressed the tested editor workload. ANE conversion remains inappropriate until a quality-preserving, block-quantized Seed-specific path exists.

## 2026-07-26 — Suppress post-accept completion loops

- Reproduced repeated blocks from MTPLX request logs: accepting a Reticle insertion caused VS Code to invoke the automatic provider again at the new cursor, even though MTPLX's session cache was empty.
- Track the exact insertion, document version, and range offset offered by Reticle. A matching document change is treated as acceptance and suppresses automatic completion until the next non-matching user edit.
- Manual forced completion remains available during suppression. Added unit coverage for multi-line acceptance, manual bypass, and re-enabling after a user edit, plus a live extension-host acceptance check.

## 2026-07-26 — Working macOS forced-completion shortcut

- Audited the installed release and found that multi-line completion, MTPLX, and the local eight-line setting were healthy, but the published manifest and README still used `Cmd+Option+Space`.
- Promoted the proven local `Option+\` workaround to the extension's default macOS binding and added manifest plus real extension-host coverage for both the binding and registered command.

## 2026-07-26 — Bounded multi-line inline completions

- Confirmed the completion transport and VS Code inline item already support multi-line insertions; Reticle's sanitizer and stream boundary deliberately truncated at the first newline.
- Added a configurable 1–64 line budget with an eight-line default, preserved indentation and CRLF normalization, retained suffix-overlap removal, and kept identifier and fenced-response safety boundaries.
- Documented that one `Tab` accepts the complete bounded block. Replacing existing ranges across multiple lines remains a separate next-edit feature because stable inline replacement ranges are single-line.
- Refreshed the README around the Reticle logo, a concise product promise, registry/CI badges, quick navigation, a compact capability table, and an install-first flow. The structure follows the restrained hero and immediate-onboarding patterns used by leading developer projects.

## 2026-07-15 — Initial extension

- Built a native VS Code inline-completion provider that sends OpenAI-compatible `prompt` plus `suffix` requests directly to the configured endpoint.
- Added streaming cancellation, Unicode-aware completion trimming, stable per-document session identifiers, adaptive request gating, endpoint validation, status controls, and opt-in multi-file context.
- Added unit, integration, and extension-host E2E coverage. The first complete package contained 52 passing unit tests and a VSIX that activated successfully under the VS Code test host.
- A dependency audit found vulnerable transitive E2E test dependencies. Pinned safe nested versions through npm overrides and revalidated the lockfile.

## 2026-07-25 — Public release preparation

- Set repository provenance to the public GitHub repository and removed development-only research links and experiment-specific names from the public snapshot.
- Confirmed that neither `roboalchemist.reticle` registry listing existed yet.
- Replaced the development CI workflow with GitHub Actions. Version tags always produce a public GitHub release; Marketplace and Open VSX publication run when their publisher tokens are configured.
- Kept registry publication optional so a missing publisher credential cannot prevent a signed VSIX from being publicly downloadable.
- Updated the development toolchain and constrained vulnerable transitive packages; `npm audit` now reports zero vulnerabilities.
- Revalidated the public build with 52 unit tests, four VS Code extension-host E2E tests, type checking, linting, formatting, and VSIX packaging.
- Audited the public snapshot and packaged VSIX for credentials, private domains, and internal experiment names before publication.
- Published the signed `v0.1.0` tag and its installable VSIX through the public GitHub release workflow.
- Made release creation idempotent so rerunning a tag safely replaces its VSIX before attempting newly configured registry publications.

## 2026-07-26 — MTPLX integration and managed service

- Recovered the archived MTPLX experiments and found that the old `a + b` probe could pass even when a server silently ignored `suffix`.
- Confirmed both archived MTPLX 2.0.2 and current 2.3.0 accept but ignore the OpenAI `suffix` field on `/v1/completions`.
- Added an explicit Qwen PSM transport so Reticle embeds prefix and suffix with the checkpoint's registered FIM special tokens.
- Designed a suffix-dependent probe where the only valid field name is declared after the cursor. A request with the suffix returned `suffixOnlyIdentifier`; the same prefix without its suffix returned an unrelated continuation.
- Installed MTPLX 2.3.0 and the verified Qwen3.5 9B Optimized Speed model on an Apple M3 Max, then created and exercised a crash-restarting user LaunchAgent.
- Passed the live provider test in 301 ms and the real VS Code extension-host test in 384 ms after warmup.
- Added a managed-service helper and documented installation, health, metrics, dashboard, logs, lifecycle commands, configuration, and troubleshooting.
- Confirmed from current Microsoft documentation that VS Code Marketplace packages are signed by the Marketplace after publication; extension authors do not need to purchase a separate developer certificate.

## 2026-07-26 — Homebrew distribution and 16 GB test bed

- Found that the M1 Mac mini test bed had adequate disk space but only 16 GB unified memory, while another user service already occupied port 8000.
- Added a public-Homebrew installation path for the service manager and retained loopback-only binding; the mini validation uses port 8010 rather than disrupting the unrelated service.
- Added conservative 16K context and Q4 paged-KV defaults plus a diagnostics command for memory-constrained Macs.
- The first mini extension-host run timed out while several competing model runtimes were resident. Stopping those runtimes reduced swap use from 11.7 GB to 0.6 GB and made the 9B model stable, but direct warm requests still took about 5 seconds on the M1; documented 16 GB as a validation floor, not an everyday performance recommendation.
- Added a Reticle-shaped warmup after service startup so one-time graph and request-path costs are paid during installation or restart instead of the first editor completion.

## 2026-07-26 — Installed-service diagnostics

- The first public `doctor` command delegated to MTPLX's generic diagnostics, which ignored Reticle's installed 9B model and custom port and falsely assessed the upstream 27B/port-8000 defaults.
- Changed lifecycle and monitoring commands to recover custom model, port, profile, context, and KV values from the installed LaunchAgent unless the caller explicitly overrides them.
- Replaced the generic diagnostic with checks for the actual executable, plist, launchd job, health response, MTP mode, warmup state, and suffix-dependent FIM result.
- Reproduced the fix on mini without re-exporting its custom port: the doctor discovered port 8010 and returned `suffixOnlyIdentifier`.

## 2026-07-26 — Registry publication retry

- The v0.3.1 tag produced a verified public GitHub release before Marketplace and Open VSX publisher credentials were available.
- Added a manual registry workflow that checks out an existing tag, downloads its already-published VSIX, and checks the file against GitHub's release-asset SHA-256 before publishing.
- Kept Marketplace and Open VSX as independently retryable targets because registry publication is non-transactional and an already-published version cannot be submitted twice.
- Added a no-publish verification target so the release download and digest path can be exercised before either registry credential exists.

## 2026-07-26 — Public registry publication

- Created the `roboalchemist` Marketplace publisher and published `roboalchemist.reticle` 0.3.1. Fresh isolated Marketplace installs succeeded on both the primary development Mac and the 16 GB Mac mini.
- Confirmed that the Marketplace serves the same VSIX as the GitHub release, with SHA-256 `a4f05ac0190401eb774872f0e2e76b04f3d391ad7eb5da181f039346a24064fe`.
- Linked the Open VSX, Eclipse Foundation, and GitHub identities, signed the publisher agreement, and created the `roboalchemist` namespace.
- Stored both registry credentials outside the repository and configured the GitHub Actions secrets `VSCE_PAT` and `OVSX_PAT`.
- Published the existing v0.3.1 GitHub release asset to Open VSX with the manual registry workflow. Open VSX's downloaded VSIX and published digest both match the GitHub release digest above.
- Installed the public Open VSX download into an isolated VS Code profile and confirmed `roboalchemist.reticle@0.3.1`.
- Open VSX renders a newly generated access token as plain text rather than a form field. Token automation must validate the extracted value before saving it or configuring CI.

## 2026-07-26 — Lighter extension icon

- Explored light, playful code-autocomplete marks after the original crosshair icon read as overly tactical.
- Selected rounded code brackets around a completion sparkle, then rebuilt the concept as a deterministic three-color SVG rather than shipping generated raster artwork.
- Rendered the registry PNG from the SVG and inspected downsampled 128 px, 32 px, and 16 px versions before packaging it into the extension.
