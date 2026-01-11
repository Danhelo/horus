# UI-001: Design System

| Field | Value |
|-------|-------|
| **Spec ID** | UI-001 |
| **Phase** | Shared |
| **Status** | Draft |
| **Package** | `@horus/frontend` |

## Summary

Define the HORUS design system - a cohesive visual language combining Egyptian mysticism with cosmic dark aesthetics. The design evokes an ancient temple housing futuristic technology, a planetarium where stars are ideas. Every visual element should reinforce the feeling of looking through a god's eye at the structure of thought.

## Requirements

### REQ-1: Color Tokens

```typescript
// tokens/colors.ts
export const colors = {
  // Base: Cosmic Dark
  background: {
    primary: '#0a0a0f',      // Deep space black
    secondary: '#121218',     // Panel background
    tertiary: '#1a1a2e',      // Hover states, borders
    elevated: '#1e1e2d',      // Floating panels
  },

  // Accent: Sacred Gold
  gold: {
    dim: '#2a2a1a',          // Barely visible
    low: '#5c4d1a',          // Low activation
    medium: '#8b7355',       // Medium activation
    primary: '#d4af37',      // Primary gold
    bright: '#ffd700',       // High activation
    glow: '#ffdf80',         // Glow effect center
  },

  // Signal Colors
  signal: {
    blue: '#00bfff',         // Fingerprint A, info
    coral: '#ff6b6b',        // Fingerprint B, error
    teal: '#20b2aa',         // Success, complete
    orange: '#ffa500',       // Warning, conflict
    purple: '#9b59b6',       // Tertiary accent
  },

  // Text
  text: {
    primary: '#f0f0f0',      // Primary text
    secondary: '#a0a0a0',    // Secondary text
    muted: '#606060',        // Disabled, hints
    gold: '#d4af37',         // Accent text
  },

  // Semantic
  semantic: {
    error: '#ff6b6b',
    warning: '#ffa500',
    success: '#20b2aa',
    info: '#00bfff',
  },
} as const;

// Activation gradient (for intensity mapping)
export const activationGradient = [
  { stop: 0.0, color: '#2a2a1a' },
  { stop: 0.25, color: '#5c4d1a' },
  { stop: 0.5, color: '#8b7355' },
  { stop: 0.75, color: '#d4af37' },
  { stop: 1.0, color: '#ffd700' },
];
```

**Acceptance Criteria:**
- [ ] All colors defined as CSS custom properties
- [ ] Dark mode only (no light mode)
- [ ] Gradient utilities for activation intensity
- [ ] Accessible contrast ratios for text

### REQ-2: Typography

```typescript
// tokens/typography.ts
export const typography = {
  fonts: {
    heading: '"Cinzel", serif',           // Egyptian feel
    body: '"Inter", sans-serif',          // Clean, readable
    mono: '"JetBrains Mono", monospace',  // Code, technical
  },

  sizes: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '2rem',    // 32px
    '4xl': '2.5rem',  // 40px
  },

  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

// Text styles
export const textStyles = {
  h1: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.bold,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  h2: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.semibold,
    letterSpacing: '0.03em',
  },
  body: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.normal,
    lineHeight: typography.lineHeights.normal,
  },
  label: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    letterSpacing: '0.02em',
  },
  code: {
    fontFamily: typography.fonts.mono,
    fontSize: typography.sizes.sm,
  },
};
```

**Acceptance Criteria:**
- [ ] Font files loaded efficiently (font-display: swap)
- [ ] Fallback fonts specified
- [ ] Text styles as reusable utilities
- [ ] Feature labels use compact sizing

### REQ-3: Spacing & Layout

```typescript
// tokens/spacing.ts
export const spacing = {
  0: '0',
  1: '0.25rem',    // 4px
  2: '0.5rem',     // 8px
  3: '0.75rem',    // 12px
  4: '1rem',       // 16px
  5: '1.25rem',    // 20px
  6: '1.5rem',     // 24px
  8: '2rem',       // 32px
  10: '2.5rem',    // 40px
  12: '3rem',      // 48px
  16: '4rem',      // 64px
};

export const layout = {
  panel: {
    padding: spacing[4],
    borderRadius: '8px',
    gap: spacing[3],
  },
  card: {
    padding: spacing[3],
    borderRadius: '6px',
  },
  input: {
    height: '40px',
    padding: `${spacing[2]} ${spacing[3]}`,
    borderRadius: '4px',
  },
};

// Z-index layers
export const zIndex = {
  graph: 0,
  panel: 10,
  overlay: 20,
  modal: 30,
  tooltip: 40,
  toast: 50,
};
```

**Acceptance Criteria:**
- [ ] Consistent spacing scale
- [ ] Panel/card dimensions defined
- [ ] Z-index prevents stacking issues
- [ ] Responsive breakpoints if needed

### REQ-4: Effects & Shadows

```typescript
// tokens/effects.ts
export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  md: '0 4px 6px rgba(0, 0, 0, 0.4)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.5)',
  glow: {
    gold: '0 0 20px rgba(212, 175, 55, 0.5)',
    blue: '0 0 20px rgba(0, 191, 255, 0.5)',
  },
};

export const blur = {
  sm: '4px',
  md: '8px',
  lg: '16px',
};

export const borders = {
  default: `1px solid ${colors.background.tertiary}`,
  accent: `1px solid ${colors.gold.primary}`,
  glow: `1px solid ${colors.gold.medium}`,
};
```

**Acceptance Criteria:**
- [ ] Glow effects for activation states
- [ ] Subtle borders maintain visibility
- [ ] Shadows create depth without overwhelming

### REQ-5: Motion & Animation

```typescript
// tokens/motion.ts
export const motion = {
  duration: {
    instant: '0ms',
    fast: '100ms',
    normal: '200ms',
    slow: '400ms',
    slower: '600ms',
  },

  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },
};

// Breathing animation for nodes
export const breathe = {
  duration: 3000,    // 3 seconds
  scaleRange: 0.02,  // 2% scale oscillation
  opacityRange: 0.1, // 10% opacity oscillation
};

// Camera animation
export const camera = {
  transitionDuration: 600,
  dampingFactor: 0.05,
  zoomSpeed: 1.2,
};
```

**Reduced Motion:**
```typescript
// Respect prefers-reduced-motion
export const useReducedMotion = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};
```

**Acceptance Criteria:**
- [ ] Consistent timing across UI
- [ ] Spring easing for organic feel
- [ ] Reduced motion preference respected
- [ ] Breathing animation for idle state

### REQ-6: Component Patterns

```typescript
// Panel component pattern
interface PanelProps {
  title?: string;
  collapsible?: boolean;
  position?: 'left' | 'right' | 'bottom';
  children: React.ReactNode;
}

// Dial component styling
const dialStyles = {
  sizes: {
    sm: { diameter: 32, strokeWidth: 2 },
    md: { diameter: 48, strokeWidth: 3 },
    lg: { diameter: 64, strokeWidth: 4 },
  },
  arc: {
    startAngle: -135,
    endAngle: 135,
    totalAngle: 270,
  },
};

// Button variants
const buttonVariants = {
  primary: {
    background: colors.gold.primary,
    color: colors.background.primary,
    hover: colors.gold.bright,
  },
  secondary: {
    background: 'transparent',
    color: colors.text.primary,
    border: borders.default,
    hover: colors.background.tertiary,
  },
  ghost: {
    background: 'transparent',
    color: colors.text.secondary,
    hover: colors.background.tertiary,
  },
};
```

**Acceptance Criteria:**
- [ ] Panel component defined
- [ ] Dial sizing standardized
- [ ] Button variants cover all use cases
- [ ] Icon button patterns

### REQ-7: Iconography

```typescript
// Egyptian-inspired iconography
export const icons = {
  // Core icons
  eye: 'eye-of-horus',           // HORUS logo, insight
  falcon: 'falcon',              // Navigate, fly
  ankh: 'ankh',                  // Amplify, life
  scarab: 'scarab',              // Transform, regenerate
  cartouche: 'cartouche',        // Snapshot, save

  // Functional icons (use Lucide/Tabler)
  play: 'play',
  pause: 'pause',
  settings: 'settings',
  search: 'search',
  menu: 'menu',
  close: 'close',
  chevronDown: 'chevron-down',
  chevronRight: 'chevron-right',

  // Sizes
  sizes: {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
  },
};
```

**Acceptance Criteria:**
- [ ] Custom icons for brand elements
- [ ] Lucide icons for standard UI
- [ ] Consistent sizing scale
- [ ] Icons accessible (aria-label)

### REQ-8: Graph-Specific Styles

```typescript
// 3D Graph visual tokens
export const graphStyles = {
  node: {
    defaultSize: 0.1,
    selectedScale: 1.5,
    hoverScale: 1.2,
    glowRadius: 0.3,
  },

  edge: {
    defaultWidth: 0.01,
    activeWidth: 0.03,
    defaultOpacity: 0.2,
    activeOpacity: 0.8,
  },

  trajectory: {
    lineWidth: 0.02,
    cursorSize: 0.15,
    glowIntensity: 0.6,
  },

  cluster: {
    borderOpacity: 0.3,
    labelScale: 1.5,
  },

  background: {
    color: colors.background.primary,
    starDensity: 0.001,           // Subtle background stars
    starSize: 0.005,
  },
};
```

**Acceptance Criteria:**
- [ ] Node sizes scale with importance/activation
- [ ] Edge visibility tied to relevance
- [ ] Consistent glow/highlight treatment
- [ ] Background subtle, not distracting

## Technical Notes

- Use CSS custom properties for runtime theming
- Tailwind CSS for utility classes (extend with custom theme)
- Consider CSS-in-JS only for dynamic 3D styles
- Font loading: preload heading font, lazy load others
- Test on various monitors (color accuracy varies)

**Tailwind Configuration:**
```typescript
// tailwind.config.ts
import { colors, spacing, typography } from './tokens';

export default {
  theme: {
    extend: {
      colors: {
        bg: colors.background,
        gold: colors.gold,
        signal: colors.signal,
      },
      fontFamily: {
        heading: typography.fonts.heading.split(','),
        body: typography.fonts.body.split(','),
        mono: typography.fonts.mono.split(','),
      },
      spacing,
    },
  },
};
```

## Dependencies

- None (foundational infrastructure)

## Open Questions

1. Should we support user-customizable accent colors?
2. High contrast mode for accessibility?
3. Print styles needed for exported artifacts?

## Changelog

| Date | Changes |
|------|---------|
| 2025-01-10 | Initial draft |
