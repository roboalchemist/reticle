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
