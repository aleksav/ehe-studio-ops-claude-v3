import { createTheme } from '@mui/material/styles';
import { colors, typography, borderRadius } from '@ehestudio-ops/shared';

const theme = createTheme({
  palette: {
    primary: {
      main: colors.primary,
    },
    secondary: {
      main: colors.secondary,
    },
    background: {
      default: colors.background,
    },
    text: {
      primary: colors.text,
    },
    divider: colors.divider,
    warning: {
      main: colors.warning,
    },
    error: {
      main: colors.error,
    },
  },
  typography: {
    fontFamily: typography.bodyFamily,
    h1: {
      fontFamily: typography.headingFamily,
      fontWeight: typography.weights.bold,
      fontSize: typography.sizes.h1,
    },
    h2: {
      fontFamily: typography.headingFamily,
      fontWeight: typography.weights.bold,
      fontSize: typography.sizes.h2,
    },
    h3: {
      fontFamily: typography.headingFamily,
      fontWeight: typography.weights.semibold,
      fontSize: typography.sizes.h3,
    },
    h4: {
      fontFamily: typography.headingFamily,
      fontWeight: typography.weights.semibold,
      fontSize: typography.sizes.h4,
    },
    body1: {
      fontSize: typography.sizes.body1,
    },
    body2: {
      fontSize: typography.sizes.body2,
    },
    caption: {
      fontSize: typography.sizes.caption,
    },
  },
  shape: {
    borderRadius: borderRadius.button,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: borderRadius.card,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: borderRadius.chip,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: borderRadius.button,
          textTransform: 'none' as const,
          fontWeight: typography.weights.semibold,
        },
      },
    },
  },
});

export default theme;
