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

For a headless session where the login keychain rejects writes, store the
profile in a dedicated keychain instead:

```bash
notary_keychain="$HOME/.reticle/notary.keychain-db"
notary_password="$(gopass show --password reticle-mlx/notary/keychain-password)"
security unlock-keychain -p "$notary_password" "$notary_keychain"
xcrun notarytool store-credentials reticle-mlx-notary \
  --key ~/.appstoreconnect/private_keys/AuthKey_KEY_ID.p8 \
  --key-id KEY_ID \
  --issuer ISSUER_ID \
  --keychain "$notary_keychain"
```

Build, sign, notarize, staple, and validate both ZIP and DMG:

```bash
private_key_file="$(mktemp)"
gopass show --password reticle-mlx/sparkle/private-key > "${private_key_file}"

RETICLE_CODESIGN_IDENTITY="Developer ID Application: Your Name (TEAM_ID)" \
RETICLE_NOTARY_PROFILE=reticle-mlx-notary \
RETICLE_NOTARY_KEYCHAIN="${notary_keychain:-}" \
RETICLE_SPARKLE_FEED_URL="https://updates.example.com/reticle-mlx/appcast.xml" \
RETICLE_SPARKLE_PUBLIC_ED_KEY="$(gopass show --password reticle-mlx/sparkle/public-key)" \
RETICLE_SPARKLE_PRIVATE_KEY_FILE="${private_key_file}" \
scripts/release-macos-app

rm -P "${private_key_file}"
```

The script verifies the signature before submission, submits the signed app
archive, staples the ticket to the app, rebuilds the ZIP, creates and signs the
DMG, notarizes and staples the DMG, and runs Gatekeeper assessment on both.
It then generates an EdDSA-signed Sparkle manifest under
`build/appcast/reticle-mlx/`. Upload
`build/release/Reticle-MLX-<version>.zip` and `.dmg` to the matching GitHub
release. Never publish an ad-hoc build from `scripts/build-macos-app`.

### Sparkle updates

Reticle MLX follows the same direct-update architecture as PTTVox:

1. Sparkle 2 is embedded in the Developer ID signed app.
2. `SUFeedURL` and `SUPublicEDKey` are injected only into release bundles.
   Configured releases also default to automatic daily checks and background
   installation without a second-launch permission prompt.
3. `scripts/stage-appcast` signs the notarized DMG with a dedicated Ed25519
   key kept outside the repository.
4. `scripts/publish-appcast` hands the signature, release notes, and DMG to an
   appcast publisher.
5. The menu-bar app checks the public HTTPS feed automatically and exposes
   **Check for Updates…** for a manual check.

Publish a staged update:

```bash
RETICLE_APPCAST_PUBLISH_SCRIPT="/path/to/appcast/scripts/publish.sh" \
RETICLE_APPCAST_API_URL="https://updates.example.com" \
RETICLE_APPCAST_API_TOKEN="token-from-secret-store" \
scripts/publish-appcast
```

Validate the public feed and its newest enclosure with the appcast service's
`validate-feed.sh`, then install the preceding release and run **Check for
Updates…**. Sparkle must download the new DMG, verify its EdDSA and Developer
ID signatures, install it, and relaunch the new version.

The first Sparkle-enabled release is a bootstrap: 0.6.0 cannot discover it.
After users install 0.7.0 or newer once, later signed releases update in-app.
To roll back, remove the bad item from the appcast before removing its public
artifact; clients only follow the feed.

The two registry publications are external, non-transactional operations. If one registry succeeds and the other fails, fix the failed credential or registry issue and republish only the missing registry rather than incrementing the version that already shipped.

## Publish an existing GitHub release

If a tag shipped before one or both registry credentials were configured, run the **Publish existing release to registries** workflow from the repository's Actions tab. Select the existing tag and either `marketplace`, `open-vsx`, or `both`. The `verify-only` target exercises the release download and digest check without contacting either registry.

The workflow checks out the selected tag, derives the expected VSIX name from its `package.json`, downloads that asset from the existing GitHub release, and verifies the downloaded SHA-256 against GitHub's release-asset digest. It publishes that exact file and does not rebuild or replace the release. A missing credential is a hard failure in this manual workflow.

If `both` publishes successfully to one registry but fails at the other, rerun
only the failed target. The workflow detects immutable versions that are
already published and treats them as a successful no-op.
