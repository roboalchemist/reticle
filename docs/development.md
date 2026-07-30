# Development guide

This repository contains both products:

- the TypeScript VS Code extension in `src/`; and
- the Swift Reticle MLX menu-bar app in `macos/ReticleMLX/`.

They share one version and release, but can be built and tested independently
during development.

## Prerequisites

- macOS for the native app; extension-only work can also run on Linux.
- Node.js 22 and npm.
- VS Code 1.96 or newer.
- Xcode command-line tools and Swift for Reticle MLX development.

Clone the repository and install the locked JavaScript dependencies:

```bash
git clone https://github.com/roboalchemist/reticle-mlx.git
cd reticle-mlx
npm ci
```

## Repository layout

| Path                | Contents                                                              |
| ------------------- | --------------------------------------------------------------------- |
| `src/completion/`   | Inline-completion coordination, streaming, sanitization, and context. |
| `src/config/`       | Settings, endpoint health, and compatibility probes.                  |
| `src/ui/`           | Status bar, Activity Bar panel, logs, and panel state.                |
| `test/`             | Unit, service-helper, integration, and extension-host tests.          |
| `macos/ReticleMLX/` | Swift package for the native menu-bar app.                            |
| `scripts/`          | Service helpers and macOS build/release tooling.                      |
| `docs/providers/`   | Provider-specific installation and validation guides.                 |

## Build the VS Code extension

Compile once:

```bash
npm run compile
```

Watch and rebuild after changes:

```bash
npm run watch
```

Open the repository in VS Code and press `F5` to launch an Extension
Development Host. The included launch configuration loads the development
extension without replacing a Marketplace installation.

Package an installable VSIX:

```bash
npm run package
code --install-extension reticle-$(node -p "require('./package.json').version").vsix --force
```

Reload existing VS Code windows after replacing an installed build.

## Extension checks

Run the normal local checks:

```bash
npm run check-types
npm run lint
npm run format:check
npm test
```

Run the extension inside a real VS Code Extension Development Host:

```bash
npm run test:e2e
```

The default end-to-end run tests activation, settings scope, commands, and the
Reticle panel without contacting a live model.

## Live endpoint tests

Live tests are explicit and should point to a loopback endpoint during routine
development.

Test the provider implementation:

```bash
RETICLE_INTEGRATION=1 \
RETICLE_INTEGRATION_BASE_URL=http://127.0.0.1:8001/v1 \
RETICLE_INTEGRATION_MODEL=default_model \
RETICLE_INTEGRATION_FIM_FORMAT=qwen \
npm run test:integration
```

Exercise the same endpoint from a real VS Code extension host:

```bash
RETICLE_E2E_LIVE=1 \
RETICLE_INTEGRATION=1 \
RETICLE_INTEGRATION_BASE_URL=http://127.0.0.1:8001/v1 \
RETICLE_INTEGRATION_MODEL=default_model \
RETICLE_INTEGRATION_FIM_FORMAT=qwen \
npm run test:e2e
```

Change the model and FIM format together. See
[model compatibility testing](model-compatibility.md#model-compatibility-testing)
before adding a provider or preset.

## Build and test Reticle MLX

Run the Swift test suite:

```bash
swift test --package-path macos/ReticleMLX
```

Build a local ad-hoc signed app:

```bash
scripts/build-macos-app
open "build/macos/Reticle MLX.app"
```

The local app is intentionally disconnected from the production Sparkle feed
unless release-only feed variables are supplied.

The service helpers can be tested without modifying a real installation:

```bash
npm test -- test/reticle-mlx-service.test.ts
npm test -- test/mtplx-service.test.ts
```

## Before committing

Run the complete cross-product check:

```bash
npm ci
npm run compile
npm test
npm run test:e2e
npm run lint
npm run format:check
npm run package
swift test --package-path macos/ReticleMLX
```

Keep credentials, private endpoints, local paths, and signing material out of
the repository. Use placeholders such as `https://api.example.com/v1` in
public documentation and tests.

## Releases

Releases are tag-driven and use one version for the extension and native app.
The public release workflow packages the VSIX and publishes it to both
extension registries. The native app release additionally requires Developer
ID signing, Apple notarization, and a signed Sparkle appcast.

Follow the [release guide](releasing.md) for the complete process.
