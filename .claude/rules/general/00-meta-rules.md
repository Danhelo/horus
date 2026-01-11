# Meta Rules: Rules About Rules

## Rule File Location

All Claude Code rules MUST be placed in `.claude/rules/` directory.

```
.claude/rules/
├── general/       # Project-wide conventions
├── frontend/      # React, R3F, Zustand patterns
├── backend/       # Hono, Drizzle patterns
├── api/           # Neuronpedia, external API patterns
└── testing/       # Vitest, Playwright patterns
```

## Rule File Format

- Use markdown (.md extension)
- Use kebab-case for filenames
- Prefix with number for ordering (00-, 01-, etc.)
- Include clear examples and anti-patterns

## When to Create/Update Rules

**Create a rule when:**
- Claude gets something wrong that should be remembered
- A pattern is established that should be followed consistently
- An external API has specific conventions
- A library has best practices that differ from defaults

**Update a rule when:**
- The pattern evolves
- New edge cases are discovered
- Better approaches are found

## Rule Priority

1. Specific rules override general rules
2. Path-scoped rules (via frontmatter) only apply to matching files
3. More recently updated rules take precedence for conflicting guidance

## Loopback Learning

After Claude successfully implements something after correction:
```
That worked. Create or update a rule in .claude/rules/
capturing what you learned so we don't repeat this.
```

This is the core mechanism for building up the stdlib over time.
