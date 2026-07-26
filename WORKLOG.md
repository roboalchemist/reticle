# Worklog

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
