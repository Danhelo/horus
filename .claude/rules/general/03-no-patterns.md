# Prohibited Patterns

## Never Use

### Build Tools
- **Bazel/Blaze** - Use pnpm workspaces + Vite
- **Webpack** - Use Vite
- **Create React App** - Use Vite

### State Management
- **Redux** - Use Zustand
- **MobX** - Use Zustand
- **Recoil** - Use Zustand

### Styling
- **CSS-in-JS with runtime** (styled-components, emotion) - Use Tailwind CSS
- **CSS Modules** alone - Combine with Tailwind if needed

### Backend
- **Express** alone - Use Hono
- **Mongoose/MongoDB** - Use Drizzle + SQLite/Postgres
- **Sequelize** - Use Drizzle

### Testing
- **Jest** alone - Use Vitest
- **Enzyme** - Use Testing Library
- **Cypress** - Use Playwright

### Package Management
- **npm** - Use pnpm
- **yarn** - Use pnpm

## Avoid Unless Necessary

### Over-Engineering
- Don't add abstraction for single-use code
- Don't create utils for one-off operations
- Don't add "just in case" error handling
- Don't create interfaces for single implementations

### Premature Optimization
- Don't optimize before measuring
- Don't add caching without evidence of need
- Don't virtualize lists under 1000 items

### Documentation Bloat
- Don't add JSDoc to self-explanatory functions
- Don't create README files in every directory
- Don't document obvious props

## When in Doubt

Ask: "Does the spec require this?"

If no, don't add it.
