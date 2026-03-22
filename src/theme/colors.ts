export const LightColors = {
  // Primary
  primary: '#2b6954',
  primaryDim: '#1d5d49',
  primaryContainer: '#b0f0d6',
  onPrimary: '#dffff0',
  onPrimaryContainer: '#1c5c48',

  // Secondary
  secondary: '#545f74',
  secondaryContainer: '#d8e3fb',
  onSecondaryContainer: '#475266',

  // Tertiary
  tertiary: '#566445',
  tertiaryContainer: '#e4f4cc',
  onTertiaryContainer: '#4f5d3e',

  // Surface & Background
  background: '#f7f9fb',
  surface: '#f7f9fb',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f0f4f7',
  surfaceContainer: '#e8eff3',
  surfaceContainerHigh: '#e1e9ee',
  surfaceContainerHighest: '#d9e4ea',

  // On Surface
  onSurface: '#2a3439',
  onSurfaceVariant: '#566166',

  // Outline
  outline: '#717c82',
  outlineVariant: '#a9b4b9',

  // Error
  error: '#9f403d',
  errorContainer: '#fe8983',
  onErrorContainer: '#752121',

  // Inverse
  inverseSurface: '#0b0f10',
  inverseOnSurface: '#9a9d9f',
  inversePrimary: '#b8f9de',

  // Legacy aliases
  textPrimary: '#2a3439',
  textSecondary: '#566166',
  textMuted: '#717c82',
  accent: '#2b6954',
  accentMuted: '#d9e4ea',
  border: '#a9b4b9',
  backgroundMuted: '#f0f4f7',
  warning: '#9f403d',
};

export const DarkColors: typeof LightColors = {
  // Primary
  primary: '#7cdbaa',
  primaryDim: '#5ec998',
  primaryContainer: '#1d5d49',
  onPrimary: '#003829',
  onPrimaryContainer: '#b0f0d6',

  // Secondary
  secondary: '#bcc7dc',
  secondaryContainer: '#3c4759',
  onSecondaryContainer: '#d8e3fb',

  // Tertiary
  tertiary: '#c8d8b0',
  tertiaryContainer: '#3e4c2f',
  onTertiaryContainer: '#e4f4cc',

  // Surface & Background
  background: '#121418',
  surface: '#121418',
  surfaceContainerLowest: '#0d1013',
  surfaceContainerLow: '#1a1e22',
  surfaceContainer: '#1e2226',
  surfaceContainerHigh: '#282d31',
  surfaceContainerHighest: '#33383c',

  // On Surface
  onSurface: '#e1e3e5',
  onSurfaceVariant: '#bfc8cd',

  // Outline
  outline: '#899499',
  outlineVariant: '#414a4e',

  // Error
  error: '#ffb4ab',
  errorContainer: '#93000a',
  onErrorContainer: '#ffdad5',

  // Inverse
  inverseSurface: '#e1e3e5',
  inverseOnSurface: '#2e3235',
  inversePrimary: '#2b6954',

  // Legacy aliases
  textPrimary: '#e1e3e5',
  textSecondary: '#bfc8cd',
  textMuted: '#899499',
  accent: '#7cdbaa',
  accentMuted: '#33383c',
  border: '#414a4e',
  backgroundMuted: '#1a1e22',
  warning: '#ffb4ab',
};

// Default export for backward compatibility during migration
export const Colors = LightColors;

export type ColorScheme = typeof LightColors;
