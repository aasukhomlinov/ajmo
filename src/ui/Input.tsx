import { CaretDown } from 'phosphor-react-native';
import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { theme } from '@/lib/theme';

import { Text } from './Text';

// General input. Text uses a real TextInput; Dropdown is a Pressable with a
// fixed CaretDown. Figma states map to runtime: Focused = lime border + caret,
// Error = error border, Filled = value present, Disabled = not editable.
// Search field = type "text" + MagnifyingGlass left icon.
export type InputType = 'text' | 'dropdown';

export interface InputProps {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  type?: InputType;
  error?: boolean;
  disabled?: boolean;
  /** Dropdown only — opens the menu. */
  onPress?: () => void;
  /** Text only — focus on mount (e.g. the search field). */
  autoFocus?: boolean;
  /** Text only — fired on the keyboard return/submit key. */
  onSubmitEditing?: () => void;
  /** Text only — return key label/affordance (e.g. "search"). */
  returnKeyType?: TextInputProps['returnKeyType'];
  style?: StyleProp<ViewStyle>;
}

export function Input({
  value,
  onChangeText,
  placeholder,
  leftIcon,
  rightIcon,
  type = 'text',
  error = false,
  disabled = false,
  onPress,
  autoFocus = false,
  onSubmitEditing,
  returnKeyType,
  style,
}: InputProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.colors.error
    : focused
      ? theme.colors.accent.base
      : theme.colors.border;

  const containerStyle = [styles.base, { borderColor }, disabled && styles.disabled, style];

  if (type === 'dropdown') {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        style={containerStyle}
      >
        {leftIcon}
        <Text
          variant="body"
          color={
            disabled
              ? theme.colors.text.disabled
              : value
                ? theme.colors.text.primary
                : theme.colors.text.secondary
          }
          style={styles.flex}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <CaretDown size={20} color={theme.colors.text.secondary} />
      </Pressable>
    );
  }

  return (
    <View style={containerStyle}>
      {leftIcon}
      <TextInput
        style={[styles.input, disabled && { color: theme.colors.text.disabled }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.text.secondary}
        editable={!disabled}
        autoFocus={autoFocus}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        selectionColor={theme.colors.accent.base}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {rightIcon}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface.base,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    padding: 0,
    fontFamily: theme.typography.body.fontFamily,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.primary,
  },
  flex: {
    flex: 1,
  },
  disabled: {
    opacity: 0.6,
  },
});
