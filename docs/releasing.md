# Releasing Reticle and Reticle MLX

Publishing is tag-driven. GitHub Actions validates every pull request and
main-branch push. A version tag creates a public GitHub release containing the
packaged VSIX and publishes to each extension registry whose token is
configured. The same version is used for the native Reticle MLX app.

## One-time repository setup

Create the `roboalchemist` publisher in the VS Code Marketplace. In Open VSX, sign the Eclipse Publisher Agreement and create or claim the `roboalchemist` namespace before the first release. Store both publisher tokens in a password manager, then add them as GitHub Actions secrets named `VSCE_PAT` and `OVSX_PAT`. Never put token values in this repository, a command argument recorded in shell history, or workflow logs.

## Release

1. Update `version` in `package.json` and the matching section in `CHANGELOG.md`.
2. Run `npm ci`, `npm run compile`, `npm test`, `npm run lint`, `npm run format:check`, and `npm run package`.
3. Commit the release, create a signed tag named `v<package-version>`, and push the tag.
4. Watch the `release` job. It rejects a tag whose name does not match `package.json`, packages once, attaches that VSIX to a GitHub release, then publishes the identical artifact to the VS Code Marketplace and Open VSX when the corresponding repository secret is present.
5. Install the published extension into a clean VS Code profile and repeat the configured-endpoint smoke test.

## Signed macOS companion

The app is distributed outside the Mac App Store with a Developer ID
Application signature, hardened runtime, and Apple notarization.

One-time local setup:

```bash
xcrun notarytool store-credentials reticle-mlx-notary \
  --key ~/.appstoreconnect/private_keys/AuthKey_KEY_ID.p8 \
  --key-id KEY_ID \
  --issuer ISSUER_ID
```

Build, sign, notarize, staple, and validate both ZIP and DMG:

```bash
RETICLE_CODESIGN_IDENTITY="Developer ID Application: Your Name (TEAM_ID)" \
RETICLE_NOTARY_PROFILE=reticle-mlx-notary \
scripts/release-macos-app
```

The script verifies the signature before submission, submits the signed app
archive, staples the ticket to the app, rebuilds the ZIP, creates and signs the
DMG, notarizes and staples the DMG, and runs Gatekeeper assessment on both.
Upload `build/release/Reticle-MLX-<version>.zip` and `.dmg` to the matching
GitHub release. Never publish an ad-hoc build from `scripts/build-macos-app`.

The two registry publications are external, non-transactional operations. If one registry succeeds and the other fails, fix the failed credential or registry issue and republish only the missing registry rather than incrementing the version that already shipped.

## Publish an existing GitHub release

If a tag shipped before one or both registry credentials were configured, run the **Publish existing release to registries** workflow from the repository's Actions tab. Select the existing tag and either `marketplace`, `open-vsx`, or `both`. The `verify-only` target exercises the release download and digest check without contacting either registry.

The workflow checks out the selected tag, derives the expected VSIX name from its `package.json`, downloads that asset from the existing GitHub release, and verifies the downloaded SHA-256 against GitHub's release-asset digest. It publishes that exact file and does not rebuild or replace the release. A missing credential is a hard failure in this manual workflow.

If `both` publishes successfully to one registry but fails at the other, rerun
only the failed target. The workflow detects immutable versions that are
already published and treats them as a successful no-op.
