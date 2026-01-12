# Implement Specification

Implement the specified feature following the spec-driven workflow.

## Usage

```
/implement specs/phase-1/graph-navigation.md
```

## Workflow

### 1. Load Context

Read in order:

1. `specs/SPECS.md` - Understand project state
2. The specified spec file - Understand requirements
3. `.claude/rules/` - Technical conventions

### 2. Analyze Current State

- What code exists for this spec?
- What tests exist?
- What dependencies are needed?
- Are prerequisite specs complete?

### 3. Plan Implementation

Before writing code:

- List the files to create/modify
- Identify the order of changes
- Note any spec ambiguities to resolve

### 4. Implement

For each requirement in the spec:

1. Write the implementation
2. Write tests for the requirement
3. Mark the acceptance criterion as complete

Follow all rules in `.claude/rules/` during implementation.

### 5. Verify

Run in order:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Fix any failures before proceeding.

### 6. Commit

If all checks pass:

```bash
git add -A
git commit -m "feat(scope): implement [feature name]

Implements: [spec path]

- REQ-1: [description]
- REQ-2: [description]
"
```

### 7. Update Spec Status

Mark completed requirements in the spec file.
Update SPECS.md if the entire spec is complete.

## On Failure

If implementation fails:

1. Note what went wrong
2. If it's a learnable pattern, update `.claude/rules/`
3. `/clear` and retry with the updated knowledge

## On Ambiguity

If the spec is unclear:

1. Note the ambiguity
2. Ask for clarification
3. Update the spec with the resolution
4. Continue implementation
