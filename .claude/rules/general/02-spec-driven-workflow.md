# Spec-Driven Development Workflow

## Core Principle

Specifications are the source of truth. Code implements specs.

## Spec Location

```
specs/
├── SPECS.md           # Master index
├── shared/            # Cross-cutting concerns
├── phase-1/           # Static Viewer
├── phase-2/           # Interactive Explorer
├── phase-3/           # Dynamic Hierarchy
└── phase-4/           # Social Features
```

## Spec File Format

Each spec follows this template:

```markdown
# [Feature Name] Specification

## Status
- [ ] Not Started / [x] In Progress / [x] Complete

## Overview
One paragraph describing what this feature does and why.

## Requirements

### REQ-1: [Requirement Name]
Description of the requirement.

**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2

### REQ-2: [Another Requirement]
...

## Technical Notes
Implementation guidance, constraints, dependencies.

## Open Questions
Unresolved decisions that need input.
```

## Implementation Workflow

### The Loopback Prompt

```
Study @specs/SPECS.md for specifications.
Study @.claude/rules for technical requirements.
Implement what is not implemented in specs/[path].
Create tests.
Run build and verify.
```

### After Success

1. Mark spec requirements as complete
2. Update SPECS.md status
3. Commit with spec reference:
   ```
   feat(frontend): implement graph navigation

   Implements: specs/phase-1/graph-navigation.md
   ```

### After Failure

1. `/clear` to reset context
2. Identify what went wrong
3. Update rules if it's a learnable pattern
4. Retry loopback prompt

## Spec Dependencies

Specs may depend on other specs:

```markdown
## Dependencies
- [x] specs/phase-1/graph-data.md (must be complete first)
- [ ] specs/shared/feature-types.md (can be parallel)
```

## Phase Boundaries

- Complete all Phase N specs before starting Phase N+1
- Exception: Shared specs can be implemented anytime
- Exception: Parallel work on independent specs within a phase

## Updating Specs

Specs are living documents. Update them when:
- Requirements change
- Technical constraints are discovered
- Implementation reveals needed clarifications

Always note changes with a date:
```markdown
## Changelog
- 2025-01-10: Added rate limit handling requirement
- 2025-01-08: Initial spec
```
