import {
  Text as RNText,
  StyleSheet,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import { theme } from '@/lib/theme';

export type TextVariant = keyof typeof theme.typography;

// RN can't consume the web-only `fontVariationSettings` axis string carried in
// the tokens, so each preset is reduced to the style props RN understands.
// Variable axes (wdth/opsz) live in the font + token doc; weight is applied here.
const baseStyles = {} as Record<TextVariant, TextStyle>;
for (const variant of Object.keys(theme.typography) as TextVariant[]) {
  const preset = theme.typography[variant];
  baseStyles[variant] = {
    fontFamily: preset.fontFamily,
    fontSize: preset.fontSize,
    fontWeight: preset.fontWeight,
    lineHeight: preset.lineHeight,
    letterSpacing: preset.letterSpacing,
  };
}

const variantStyles = StyleSheet.create(baseStyles);

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: string;
}

export function Text({
  variant = 'body',
  color = theme.colors.text.primary,
  style,
  ...rest
}: TextProps) {
  return <RNText style={[variantStyles[variant], { color }, style]} {...rest} />;
}
