# Worklog

## 2026-07-28 — Diagnostics and model benchmarking

- Keep the settings navigation permanently visible with a fixed sidebar rather
  than relying on `NavigationSplitView`'s automatic hide/show toolbar item.
- Use a native vertical split for the shared Activity pane, giving every tab a
  draggable divider while retaining a useful minimum height for both sides.
- Rank the explicit `Recommended` preset first with a stable secondary catalog
  order. Launch at Login now has its own Startup card instead of being mixed
  into runtime cache controls.
- Read only the last 256 KiB of each active-runtime log so multi-gigabyte logs
  cannot freeze the settings UI. The Logs tab combines those tails with the
  latest service status and provides copy, export, doctor, and folder actions.
- Added a streaming benchmark client using the same FIM transport and
  `x-reticle-autocomplete-session-id` header as the extension. A unique session
  measures the cold prompt path, three repeated requests measure the warm
  median, and SSE arrival time provides real TTFT.
- Some servers omit completion-token usage in streamed responses. Preserve
  reported counts when present and visibly mark a character-derived token
  estimate otherwise.
- Periodic status polling previously set `Checking…` before every five-second
  probe and allowed probes to overlap. Preserve the last resolved state during
  polling and serialize refreshes so an unhealthy service no longer flashes
  between two labels.

## 2026-07-27 — Resizable sidebar settings

- Split the increasingly tall settings form into four focused sidebar
  destinations: General, Models, Custom Model, and VS Code Setup. General is
  deliberately the default so routine service controls remain one click away.
- Put all validated presets in an independent scrolling model catalog and added
  a compact card fallback for narrower windows.
- Reduced the window's minimum size from 820×900 to 720×520 while retaining a
  useful 980×760 initial size and unrestricted expansion.

## 2026-07-27 — Packaged VS Code doctor alias fix

- The final Homebrew-installed 0.8.0 smoke test caught a mismatch that the app
  path masked with explicit environment overrides: the standalone doctor sent
  requests to `default_model` but compared VS Code settings against the
  configured Hugging Face model ID.
- Changed settings validation to use the same API-model variable as the FIM
  request and added a regression fixture where the service model and API alias
  intentionally differ.

## 2026-07-27 — Hybrid model manager and verified downloads

- Replaced the preset dropdown with five full model cards and separate Download
  and Select actions. Runtime, approximate size, minimum memory, purpose, and
  relative quality/speed/memory scores now remain visible for comparison.
- Implemented byte-accurate Hugging Face progress for MLX-LM models and consumed
  MTPLX 2.3.0's native newline-delimited progress stream. Pause and resume send
  `SIGSTOP`/`SIGCONT` to the real worker; cancel terminates it while preserving
  completed files. MTPLX also resumes partial files natively.
- Use a hybrid runtime: MLX-LM remains the general loader for Qwen2.5, Seed, and
  Codestral, while Qwen3.5 9B Optimized Speed is routed through MTPLX's verified
  native-MTP path. Installing one runtime stops the other to avoid unified-memory
  contention.
- The first Codestral health check loaded successfully but repeated the suffix.
  Its community MLX conversion ships a Transformers v1 tokenizer whose IDs
  11–13 are labeled as generic controls, while Mistral's reference v3 tokenizer
  maps them to `[PREFIX]`, `[MIDDLE]`, and `[SUFFIX]`. Reticle now prepares a
  small official-tokenizer overlay with symlinks to the cached weights and uses
  MLX-LM's `default_model` alias so requests cannot dynamically reload the broken
  source tokenizer.
- Codestral generation intentionally begins reproducing the supplied suffix.
  Stop at the first nonempty suffix line and remove that stop sequence from the
  response; when the suffix starts with a newline, omit that stop so legitimate
  multi-line output is not truncated. A newline-only stop broke the live
  multi-line provider test.
- Re-ran managed, suffix-dependent doctors against all five cards. Qwen 1.5B,
  Qwen 3B, Seed 8B, and Codestral 22B passed through MLX-LM 0.31.1/MLX 0.30.5;
  Qwen3.5 9B passed with `generation_mode=mtp` and `mtp_enabled=true` through
  MTPLX 2.3.0.
- Added one-click extension installation and a VS Code doctor that checks the
  CLI, installed extension, user settings, endpoint health, and a live
  extension-shaped FIM insertion.

## 2026-07-27 — Prompt-free automatic updates

- Sparkle normally asks permission on the second launch before scheduling update checks. That interaction is easy to miss in a background-only accessory app.
- Configured release bundles now set `SUEnableAutomaticChecks`, `SUAutomaticallyUpdate`, and a no-profile default. Development bundles remain disconnected unless both feed URL and public key are injected.
- Use 0.7.0 as the installed bootstrap and 0.7.1 as the first production-feed update to validate automatic download, Ed25519/Developer ID verification, installation, and relaunch.

## 2026-07-27 — Sparkle auto-updates and current menu-bar mark

- Mirrored PTTVox's Sparkle 2 architecture with an app-specific Ed25519 signing key, release-only feed configuration, signed appcast staging, publishing handoff, and a manual **Check for Updates…** menu item.
- Keep ordinary development bundles unconfigured so they cannot poll or trust a production update feed accidentally. Release packaging now fails closed unless the feed URL, public key, and exported private key are provided.
- The first Sparkle-enabled release is necessarily a bootstrap because existing 0.6.0 bundles contain no updater. Subsequent releases can update in-app after the bootstrap is installed once.
- Replaced the state-dependent SF Symbol tray mark with a monochrome template derived from the selected rounded code-brackets-and-sparkle logo. The transparent white source is rendered at 36 pixels and displayed at 18 points so AppKit can tint it correctly in both menu-bar appearances.
- SwiftPM 6.2 stalled in a login-Keychain lookup after resolving Sparkle's binary artifact, even though the official archive downloaded immediately with `curl`. Preloading the same verified upstream artifact allowed local validation; clean CI remains responsible for exercising the normal SwiftPM download path.

## 2026-07-27 — Reticle MLX native macOS companion

- Renamed the public repository and local checkout to `reticle-mlx` while preserving the installed extension ID `roboalchemist.reticle`.
- Generalized the managed MLX-LM service from Seed-specific names to a model plus FIM-format configuration. Seed remains the quality preset; Qwen 3B is the speed preset; custom MLX model paths and Seed, Qwen, or OpenAI transports are supported.
- Added a native Swift menu-bar application with health polling, lifecycle controls, model settings, launch-at-login support, log access, a real doctor probe, and matching VS Code configuration on the clipboard.
- Added deterministic application-bundle assembly, Developer ID hardened-runtime signing, Apple notarization, ticket stapling, ZIP/DMG packaging, and Gatekeeper verification scripts.
- Preserve the legacy Seed runtime and logs during migration, but remove its LaunchAgent only after the replacement service becomes healthy so both cannot claim port 8001.
- Both Apple submissions were accepted and stapled, but the final Perl-backed `shasum` inherited an invalid `C.UTF-8` locale on the release Mac. Use OpenSSL for release digests so a completed notarization cannot be followed by a locale-only false failure.

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

## 2026-07-28 — Zeta MLX quantization and preset

- Verified that `zed-industries/zeta` is a Qwen2.5-Coder 7B edit-prediction
  fine-tune with Apache-2.0 licensing and a native editable-region rewrite
  protocol. Its tokenizer also retains the Qwen FIM control tokens.
- Downloaded and exercised the MLX Community 4-bit, 6-bit, and 8-bit
  group-size-64 conversions on an M3 Max. All three returned the exact
  suffix-only identifier through Qwen PSM. The initial native-Zeta pass measured
  roughly 85/61/48 tokens per second and 4.8/6.6/8.5 GB peak memory,
  respectively.
- Ran the 4-bit and 8-bit models across all 33 public Zeta eval cases. Both
  produced 15 exact references and identical output on 26 cases. The 8-bit
  conversion won four pairwise similarity comparisons versus three for 4-bit,
  but decoded at about 46 tokens/s rather than 83 tokens/s. Selected 4-bit for
  the interactive editor latency and memory tradeoff.
- Added Zeta as model option number two, behind the recommended Seed preset.
  Reticle uses its validated Qwen FIM compatibility path for safe cursor-local
  multi-line ghost text. Full Zeta region rewriting remains separate because
  stable VS Code inline completion ranges cannot safely represent arbitrary
  multi-location edits.
- Live provider testing exposed that MLX-LM accepted but did not enforce the
  request's Qwen stop strings. Zeta generated the correct suffix-dependent
  identifier and then repeated new assignments. Added both a suffix-boundary
  request stop and client-side stream/sanitizer guard, preserving multiline
  completion when the suffix begins on a later line. The single-line and
  bounded multiline live integration cases then passed.
