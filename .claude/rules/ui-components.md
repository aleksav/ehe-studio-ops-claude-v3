---
description: Rules for web and mobile UI components — enforces design system, component patterns, and accessibility standards.
globs:
  - "web/src/**/*.tsx"
  - "mobile/src/**/*.tsx"
---

## Component rules

- **Web**: Use MUI components — never build custom equivalents (Button, TextField, Card, etc.)
- **Web styling**: Use `sx` prop, not `makeStyles` or `styled`
- **Web cards**: `elevation={0}` with `border: '1px solid'`, `borderColor: 'divider'`, `borderRadius: 2-3`
- **Mobile**: Use `StyleSheet.create` for all styles
- **Mobile touch targets**: Minimum 44x44px

## Design tokens

- Import colors, typography, spacing, and borderRadius from `@ehestudio-ops/shared` or `shared/src/theme/tokens.ts`
- Never hardcode brand colors — use token references
- Primary: `#E91E8C`, Secondary: `#1E6FE9`, Warning: `#F59E0B`, Error: `#DC2626`

## Layout

- Compact over spacious — minimize vertical space used by headers, labels, and padding
- Content should dominate the viewport
- Use tabs, collapsible sections, and toggles for progressive disclosure

## Shared components

- Use `ProjectTaskBoard` for any task board view (standup, project detail)
- Check `web/src/components/` before creating new components

## Accessibility

- Semantic HTML elements (`<nav>`, `<main>`, `<section>`)
- ARIA labels on icon-only buttons
- Sufficient color contrast (WCAG AA)

## Code size

- Keep pages under 500 lines — extract components when needed
- Every feature must include API, web, AND mobile implementations
