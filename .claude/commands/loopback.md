# Loopback: Study and Implement

The core spec-driven development loop.

## Usage

```
/loopback
```

or with a specific spec:

```
/loopback specs/phase-1/graph-data.md
```

## What This Does

1. **Study Specs**
   - Read `specs/SPECS.md` to understand project state
   - Identify incomplete specs in the current phase
   - If a specific spec was provided, focus on that

2. **Study Rules**
   - Load all rules from `.claude/rules/`
   - Apply technical conventions to implementation

3. **Implement What's Missing**
   - For each incomplete requirement in the spec:
     - Write implementation code
     - Write tests
     - Verify with build/lint/test

4. **Commit on Success**
   - Use conventional commit format
   - Reference the spec in commit body

5. **Report**
   - List what was implemented
   - Note any blockers or ambiguities
   - Suggest next steps

## The Prompt

This command expands to:

```
Study @specs/SPECS.md for functional specifications.
Study @.claude/rules for technical requirements.
Implement what is not implemented.
Create tests for new code.
Run "pnpm lint && pnpm typecheck && pnpm test && pnpm build"
If all pass, commit with conventional commit format.
Report what was done and what's next.
```

## When to Use

- Starting a work session
- After `/clear` to resume progress
- After fixing a blocker
- When you want Claude to autonomously advance the project

## Continuous Mode

For extended autonomous work:

```
/loopback --until-blocked
```

This will keep implementing specs until:
- All specs in the current phase are complete
- An ambiguity requires human input
- A test failure can't be automatically resolved
