/**
 * EHEStudio Ops — Design Tokens
 * Shared across web (MUI) and mobile (React Native).
 */

export const colors = {
  primary: '#E91E8C', // EHE pink
  secondary: '#1E6FE9', // EHE blue
  background: '#FFFFFF',
  text: '#0D0D0D',
  divider: '#E5E5E5',
  warning: '#F59E0B', // amber — stale indicators
  error: '#DC2626', // red — overdue / cap exceeded
} as const;

export const typography = {
  headingFamily: '"DM Sans", sans-serif',
  bodyFamily: '"Source Sans 3", sans-serif',
  headingFamilyMobile: 'DMSans-Regular', // React Native font name
  bodyFamilyMobile: 'SourceSans3-Regular',
  sizes: {
    h1: 32,
    h2: 24,
    h3: 20,
    h4: 18,
    body1: 16,
    body2: 14,
    caption: 12,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  card: 12,
  button: 8,
  input: 8,
  chip: 16,
} as const;

export type Colors = typeof colors;
export type Typography = typeof typography;
export type Spacing = typeof spacing;
export type BorderRadius = typeof borderRadius;
