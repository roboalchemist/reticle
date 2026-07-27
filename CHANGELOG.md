# Changelog

All notable changes to Reticle are documented here.

## 0.8.1

- Make the packaged `reticle-mlx vscode-doctor` validate the MLX-LM API alias
  (`default_model`) instead of incorrectly expecting the underlying Hugging
  Face model ID.

## 0.8.0

- Replace the model dropdown with five always-visible cards for Qwen 1.5B,
  Qwen 3B, Qwen3.5 9B MTPLX, Seed-Coder 8B, and Codestral 22B, including
  runtime, size, memory floor, use case, and relative score details.
- Add exact byte-progress downloads with transfer rate, ETA, pause, resume, and
  cancel controls.
- Route the speculative Qwen3.5 preset through MTPLX while retaining MLX-LM for
  general and custom models.
- Add Codestral's native FIM transport and an official-v3-tokenizer overlay for
  the community MLX conversion.
- Add one-click VS Code extension installation and a VS Code integration doctor
  to the macOS app.
- Use the current Reticle logo in every app surface and size the settings window
  to show the full model list on a large desktop without a page scrollbar.

## 0.7.1

- Enable prompt-free automatic update checks and automatic installation in configured Reticle MLX release bundles.
- Keep update polling disabled in development bundles that do not carry both the production feed URL and Ed25519 public key.

## 0.7.0

- Add Sparkle 2 automatic updates to the Reticle MLX menu-bar app, backed by a dedicated Ed25519 key and public signed appcast.
- Add a manual **Check for Updates…** menu item plus release tooling for signed appcast staging, publishing, validation, and rollback.
- Require update-feed configuration for Developer ID releases while leaving local development builds safely disconnected.
- Replace the old state glyph in the macOS menu bar with a monochrome template derived from Reticle's current code-brackets-and-sparkle logo.

## 0.6.0

- Rename the public repository and Apple Silicon companion to Reticle MLX while preserving the `roboalchemist.reticle` VS Code extension identity.
- Add a native Swift menu-bar app for installing, starting, stopping, restarting, diagnosing, and monitoring local MLX-LM completion models.
- Generalize the managed service from Seed-only settings to selectable Seed, Qwen, and OpenAI FIM transports with quality, speed, and custom-model presets.
- Add a hardened-runtime Developer ID signing, Apple notarization, stapling, DMG/ZIP packaging, and Gatekeeper validation pipeline.
- Migrate the legacy Seed LaunchAgent without deleting its private runtime, logs, or Hugging Face cache.

## 0.5.0

- Add Seed-Coder's native suffix-prefix-middle FIM serialization.
- Add a managed, loopback-only Seed-Coder + MLX-LM service for Apple Silicon with prompt caching, health checks, monitoring, logs, and a real FIM doctor probe.
- Publish and document a 3.6 GB mixed 3/4-bit Seed-Coder 8B conversion that reaches 93.2 tokens/s and 134–146 ms cached identifier completions on a 128 GB M3 Max.
- Document why no current Seed EAGLE, MTP, or ANE path beats the tested MLX setup.

## 0.4.2

- Stop automatic completion from immediately retriggering after a Reticle suggestion is accepted.
- Re-enable automatic completion on the user's next edit while keeping manual forced completion available.
- Add unit and live extension-host regression coverage for the acceptance loop.

## 0.4.1

- Use `Option+\` as the default macOS shortcut for forced inline completion.
- Document automatic triggering, manual triggering, and whole-block `Tab` acceptance together.

## 0.4.0

- Add bounded multi-line ghost-text completions with one-press `Tab` acceptance.
- Add `reticle.maxLines`, configurable from 1–64 lines with an eight-line default.
- Preserve indentation, normalize line endings, remove suffix overlap across lines, and retain identifier and fenced-response safety boundaries.
- Refresh the GitHub README with the Reticle logo, registry and CI badges, quick navigation, a capabilities overview, and a clearer install-first flow.
- Add live MTPLX coverage for an actual multi-line TypeScript completion.

## 0.3.2

- Replace the dark crosshair-style extension icon with a lighter code-brackets-and-sparkle mark.
- Add the deterministic SVG source and retain a crisp 128 px PNG for extension registries.

## 0.3.1

- Remember custom model, port, profile, context, and KV settings from the installed LaunchAgent for later service commands.
- Make `doctor` inspect the actual Reticle service and run a suffix-dependent FIM probe instead of reporting MTPLX's unrelated default configuration.

## 0.3.0

- Distribute the managed MTPLX service helper through the public `roboalchemist/tap` Homebrew tap.
- Bound the default MTPLX context to 16K tokens and use Q4 paged KV cache for 16 GB Apple Silicon systems.
- Add an MTPLX diagnostics command, a Reticle-shaped FIM warmup, and documentation for source-free install, monitoring, and low-memory recovery.

## 0.2.0

- Add explicit Qwen PSM serialization for MTPLX and other plain-completion servers.
- Replace the continuation-friendly endpoint probe with a suffix-dependent identifier test.
- Add a managed Apple Silicon MTPLX LaunchAgent with install, health, metrics, dashboard, logs, restart, and uninstall commands.
- Validate MTPLX 2.3.0 through both the live provider harness and a real VS Code extension host.
- Add a complete MTPLX provider guide and update the compatibility matrix.

## 0.1.0

- Add BYOK fill-in-the-middle inline completions with streaming SSE support.
- Add endpoint health checks, status controls, and language filters.
- Add opt-in multi-file context with workspace privacy boundaries.
- Add offline unit tests, a live endpoint harness, and provider setup guides.
