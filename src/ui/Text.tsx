import {
  Text as RNText,
  StyleSheet,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import { theme } from '@/lib/theme';

export type TextVariant = keyof typeof theme.typography;

// Each preset maps to a STATIC font cut (TikTokSans-Display/H1/Body/...) with
// weight + width baked into the family — RN can't drive variable axes at
// runtime. So we set only fontFamily and the size/spacing props RN understands;
// no fontWeight (it would make Android faux-bold an already-bold cut).
const baseStyles = {} as Record<TextVariant, TextStyle>;
for (const variant of Object.keys(theme.typography) as TextVariant[]) {
  const preset = theme.typography[variant];
  baseStyles[variant] = {
    fontFamily: preset.fontFamily,
    fontSize: preset.fontSize,
    lineHeight: preset.lineHeight,
    letterSpacing: preset.letterSpacing,
    // Some presets bake text case (e.g. sectionHeader -> uppercase).
    ...('textTransform' in preset ? { textTransform: preset.textTransform } : null),
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
