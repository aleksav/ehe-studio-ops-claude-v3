---
name: ux-review
description: Review a page or component for UI/UX issues — layout, spacing, accessibility, consistency, and mobile parity.
user_invocable: true
---

You are reviewing the UI/UX of a page or component in EHEStudio Ops.

## What to review

1. **Layout & spacing** — Is content density appropriate? Are headers, labels, and padding compact enough that content dominates the viewport?
2. **Design token usage** — Are colors, typography, spacing, and border radius values from `shared/src/theme/tokens.ts`?
3. **Component consistency** — Are MUI components (web) or StyleSheet (mobile) used correctly? No custom equivalents of existing components?
4. **Accessibility** — Semantic HTML, ARIA labels on icon-only buttons, sufficient contrast, touch targets ≥ 44px on mobile?
5. **Responsive behavior** — Does it work at 360px, 768px, and 1280px? Are MUI breakpoints used?
6. **Mobile parity** — Does the same feature exist and work similarly on mobile?
7. **Visual consistency** — Same card styles, same button patterns, same status colors across pages?

## How to review

1. Read the file(s) the user specifies (or infer from context)
2. Check against the design system in `shared/src/theme/tokens.ts`
3. Look at similar pages for consistency (e.g., compare standup board to project detail board)
4. Output a structured review with sections: **Good**, **Issues**, **Suggestions**
5. For each issue, include the file path, line number, and a concrete fix

## Design system reference

- Primary: `#E91E8C` (pink) — brand, CTAs, active states
- Secondary: `#1E6FE9` (blue) — accents, links, info
- Warning: `#F59E0B` — stale indicators
- Error: `#DC2626` — overdue, destructive
- Typography: DM Sans headings, Source Sans 3 body
- Spacing: 4, 8, 16, 24, 32, 48px
- Border radius: card=12, button=8, input=8, chip=16
- Cards: `elevation={0}`, `border: '1px solid'`, `borderColor: 'divider'`
