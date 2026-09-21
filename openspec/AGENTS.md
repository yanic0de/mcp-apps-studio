# OpenSpec Instructions for AI Assistants

This directory holds the project's specifications in OpenSpec format. Instructions for working with the code (commands, architecture, constraints) live in the root `CLAUDE.md`; this file is only about specs.

## Structure

```
openspec/
├── project.md            # project context: purpose, stack, conventions, glossary
├── AGENTS.md             # this file
├── specs/                # current truth: what IS built
│   └── <capability>/
│       └── spec.md
└── changes/              # proposals: what SHOULD change
    ├── <change-id>/
    │   ├── proposal.md   # why and what changes
    │   ├── tasks.md      # implementation checkboxes
    │   ├── design.md     # optional: technical decisions
    │   └── specs/<capability>/spec.md   # spec deltas
    └── archive/          # completed changes, merged into specs/
```

## When to Do What

- **Behavior change, new capability, contract change** → first `changes/<change-id>/` with a proposal, tasks and spec deltas. Implement by tasks.md. After merging into `main`, apply the deltas to `specs/` and move the directory to `archive/`.
- **Typo fix, refactor without behavior change, test cleanup** → no proposal, but if a spec disagrees with the code, fix the spec in the same commit.
- **"How does this work today?"** → read `specs/`, not `changes/`.

A change id is a kebab-case verb + object: `add-pending-mock-kind`, `lazy-load-mcp-sdk`.

## spec.md Format

```markdown
# <Capability name>

## Purpose
One or two paragraphs: why the capability exists.

## Requirements

### Requirement: <short requirement name>
<Subject> SHALL <normative behavior>. The keyword SHALL (or MUST) is mandatory.

#### Scenario: <scenario name>
- **WHEN** <condition or action>
- **THEN** <observable result>
- **AND** <additional result, optional>
```

Validator rules:

- every `### Requirement:` has at least one `#### Scenario:`;
- the requirement text contains `SHALL` or `MUST`;
- headings are exactly `## Purpose`, `## Requirements`, `### Requirement:`, `#### Scenario:`;
- scenario steps are a bulleted list with bold `WHEN`/`THEN`/`AND`.

## Delta Format in changes/<id>/specs/<capability>/spec.md

```markdown
## ADDED Requirements
### Requirement: <new requirement>
...full text with scenarios...

## MODIFIED Requirements
### Requirement: <name of the existing requirement, unchanged>
...full new text of the requirement with scenarios...

## REMOVED Requirements
### Requirement: <name being removed>
**Reason**: why it is removed.
**Migration**: what consumers should do.

## RENAMED Requirements
- FROM: `### Requirement: old name`
- TO: `### Requirement: new name`
```

In `MODIFIED`, the requirement name must match the existing one character for character — that is how the delta finds what to replace.

## Commands

```bash
export OPENSPEC_TELEMETRY=0                          # the CLI collects anonymous stats; opt out
npx @fission-ai/openspec list --specs                # specs and their requirement counts
npx @fission-ai/openspec list                        # active changes
npx @fission-ai/openspec validate --all --strict     # validate all specs and changes (without --all, nothing is checked in CI)
npx @fission-ai/openspec show <change-id>            # inspect a change
npx @fission-ai/openspec archive <change-id>         # apply deltas to specs/ and move to archive/
```

Run the validator after every edit under `openspec/`; never commit with a failing validation.

## Relation to the Code

- One capability ≈ one package (see the table in `project.md`), plus `protocol` (SEP-1865 constants) and `tool-mocks` (mock schema and router).
- Scenarios must be verifiable: each has, or should get, a test in `src/*.test.ts` or `e2e/tests/`.
- If the code and a spec disagree and the change was not made through `changes/`, the code wins: bring the spec in line with the code and note the discrepancy in the commit.
