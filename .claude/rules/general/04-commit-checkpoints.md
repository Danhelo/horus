# Commit After Testing Checkpoints

## Rule

After successfully passing verification checkpoints (typecheck, build, tests), **always offer to commit the changes**.

## When to Commit

Commit after these pass:
```bash
pnpm typecheck  # ✅
pnpm build      # ✅
pnpm test       # ✅ (or vitest run)
```

## Workflow

1. Implement feature/fix
2. Run verification commands
3. If all pass → immediately ask user: "Ready to commit?"
4. Don't wait for user to remember - proactively offer

## Commit Message Format

Follow conventional commits:
```
feat(scope): short description

- Key change 1
- Key change 2

Implements: specs/phase-X/SPEC-ID.md (if applicable)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

## Why This Matters

- Prevents losing work
- Creates clear checkpoints to revert to
- Documents progress incrementally
- Makes code review easier
