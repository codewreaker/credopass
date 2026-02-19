/**
 * Mobile UI Theme
 * Central export for all theme tokens
 */

export * from './colors';
export * from './spacing';
export * from './typography';

import { colors } from './colors';
import { spacing } from './spacing';
import { typography } from './typography';

export const theme = {
  colors,
  spacing,
  typography,
};

export type Theme = typeof theme;
