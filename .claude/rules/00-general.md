# HORUS Project Rules

## Structure
```
packages/{frontend,backend,shared}  # React+R3F+Zustand | Hono+Drizzle+SQLite | Types
specs/                              # Source of truth
.claude/rules/                      # This stdlib
```

## Conventions
- **Files**: Components=PascalCase, hooks=useCamelCase, utils=camelCase
- **Imports**: react → third-party → @horus/* → relative
- **Git**: `feat|fix|refactor|docs(scope): msg` + `Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>`
- **Env**: Frontend=`VITE_*`, Backend=no prefix, never commit `.env`

## Workflow
```
1. Study specs/SPECS.md
2. Study .claude/rules/
3. Implement unfinished spec
4. Create tests
5. pnpm build && pnpm test
6. Commit on success
```
After success → update rules with learnings. After failure → /clear, retry.

## Prohibited
**Never**: Bazel, Webpack, CRA, Redux, MobX, styled-components, Express, Mongoose, Jest alone, npm/yarn
**Avoid**: premature abstraction, over-engineering, JSDoc on obvious code, unused backwards-compat shims

## Rules About Rules
- Location: `.claude/rules/` only
- Format: markdown, kebab-case, numbered prefix
- Create when: pattern established, API quirk found, library gotcha discovered
- Specific rules > general rules
