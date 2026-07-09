import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { theme } from '@/lib/theme';

import { Text } from './Text';

// One-time-code entry — six digit cells styled like a single-character Input
// (same surface, border, radius and state colors; see Input.tsx). One hidden
// TextInput drives all cells: the visible boxes only mirror value characters,
// so focus never jumps between fields, backspace naturally steps back a cell,
// and iOS autofill / paste of a full code fills everything at once. The active
// cell (the next one to type into) shows the lime border + a blinking caret;
// `error` paints every cell with the error border, mirroring Input's Error
// state. Figma: DS component "CodeInput".
const CODE_LENGTH = 6;
const CARET_WIDTH = 2;
const CARET_HEIGHT = 20;
const CELL_WIDTH = 44;
const CELL_HEIGHT = 52;
const CARET_BLINK_MS = 500;

export interface CodeInputProps {
  /** Digits entered so far ('' … up to `length` chars). */
  value: string;
  onChange: (code: string) => void;
  /** Fired once when the last digit lands (also for paste/autofill). */
  onComplete?: (code: string) => void;
  /** Wrong/expired code — every cell gets the error border. */
  error?: boolean;
  length?: number;
  /** Open the keyboard on mount (the usual case on the code screen). */
  autoFocus?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function CodeInput({
  value,
  onChange,
  onComplete,
  error = false,
  length = CODE_LENGTH,
  autoFocus = false,
  accessibilityLabel,
  style,
}: CodeInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [caretOpacity] = useState(() => new Animated.Value(1));

  const activeIndex = Math.min(value.length, length - 1);
  const showCaret = focused && value.length < length;

  useEffect(() => {
    if (!showCaret) return;
    caretOpacity.setValue(1);
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(caretOpacity, {
          toValue: 0,
          duration: 0,
          delay: CARET_BLINK_MS,
          useNativeDriver: true,
        }),
        Animated.timing(caretOpacity, {
          toValue: 1,
          duration: 0,
          delay: CARET_BLINK_MS,
          useNativeDriver: true,
        }),
      ]),
    );
    blink.start();
    return () => blink.stop();
  }, [showCaret, caretOpacity]);

  const handleChange = (raw: string) => {
    const next = raw.replace(/\D/g, '').slice(0, length);
    if (next === value) return;
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  return (
    <Pressable
      style={[styles.row, style]}
      onPress={() => inputRef.current?.focus()}
      accessible={false}
    >
      {Array.from({ length }, (_, i) => {
        const digit = value[i];
        const active = focused && i === activeIndex && value.length < length;
        const borderColor = error
          ? theme.colors.error
          : active
            ? theme.colors.accent.base
            : theme.colors.border;
        return (
          <View key={i} style={[styles.cell, { borderColor }]}>
            {digit ? (
              <Text variant="h2">{digit}</Text>
            ) : active ? (
              <Animated.View style={[styles.caret, { opacity: caretOpacity }]} />
            ) : null}
          </View>
        );
      })}
      {/* Invisible input stretched over the row — it receives all taps and
          keystrokes; the cells above are purely presentational. */}
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={handleChange}
        maxLength={length}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        autoFocus={autoFocus}
        caretHidden
        selectionColor="transparent"
        autoCorrect={false}
        spellCheck={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={accessibilityLabel}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  cell: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.md,
    borderWidth: 1,
    backgroundColor: theme.colors.surface.base,
  },
  caret: {
    width: CARET_WIDTH,
    height: CARET_HEIGHT,
    borderRadius: CARET_WIDTH / 2,
    backgroundColor: theme.colors.accent.base,
  },
  // NOT opacity 0 — a fully transparent view loses the iOS long-press edit
  // menu, killing manual paste. Transparent text on a visible input keeps it.
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    fontSize: 1,
    color: 'transparent',
    backgroundColor: 'transparent',
  },
});
