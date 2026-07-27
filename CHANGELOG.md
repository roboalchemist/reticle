# Changelog

All notable changes to Reticle are documented here.

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
