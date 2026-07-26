# Releasing Reticle

Publishing is tag-driven. GitHub Actions validates every pull request and main-branch push. A version tag creates a public GitHub release containing the packaged VSIX and publishes to each extension registry whose token is configured.

## One-time repository setup

Create the `roboalchemist` publisher in the VS Code Marketplace. In Open VSX, sign the Eclipse Publisher Agreement and create or claim the `roboalchemist` namespace before the first release. Store both publisher tokens in a password manager, then add them as GitHub Actions secrets named `VSCE_PAT` and `OVSX_PAT`. Never put token values in this repository, a command argument recorded in shell history, or workflow logs.

## Release

1. Update `version` in `package.json` and the matching section in `CHANGELOG.md`.
2. Run `npm ci`, `npm run compile`, `npm test`, `npm run lint`, `npm run format:check`, and `npm run package`.
3. Commit the release, create a signed tag named `v<package-version>`, and push the tag.
4. Watch the `release` job. It rejects a tag whose name does not match `package.json`, packages once, attaches that VSIX to a GitHub release, then publishes the identical artifact to the VS Code Marketplace and Open VSX when the corresponding repository secret is present.
5. Install the published extension into a clean VS Code profile and repeat the configured-endpoint smoke test.

The two registry publications are external, non-transactional operations. If one registry succeeds and the other fails, fix the failed credential or registry issue and republish only the missing registry rather than incrementing the version that already shipped.
