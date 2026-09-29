# Spec Delta: distribution

## ADDED Requirements

### Requirement: Trusted publishing with provenance
Both published manifests SHALL set `publishConfig.provenance` to `true`. The release workflow SHALL publish through npm Trusted Publishing: its job has `id-token: write`, and no step receives an `NPM_TOKEN` or `NODE_AUTH_TOKEN`.

#### Scenario: Release workflow without a token
- **WHEN** the unit tests inspect `release.yml`
- **THEN** no step's `env` contains `NPM_TOKEN` or `NODE_AUTH_TOKEN` and the workflow permissions include `id-token: write`

#### Scenario: Provenance requested
- **WHEN** the unit tests read both published `package.json` files
- **THEN** each has `publishConfig.provenance === true`
