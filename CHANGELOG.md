# Changelog

All notable changes to Reticle are documented here.

## 0.3.0

- Distribute the managed MTPLX service helper through the public `roboalchemist/tap` Homebrew tap.
- Bound the default MTPLX context to 16K tokens and use Q4 paged KV cache for 16 GB Apple Silicon systems.
- Add an MTPLX diagnostics command and document source-free install, monitoring, and low-memory recovery.

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
