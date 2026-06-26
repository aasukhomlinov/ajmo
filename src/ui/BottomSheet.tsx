import { X } from 'phosphor-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/lib/theme';

import { IconButton } from './IconButton';
import { Text } from './Text';

// Bottom-sheet over a scrim (filters, pickers). Built on RN's Modal — no
// gesture library, no native module. The sheet slides up while the scrim fades;
// tapping the scrim, the close glyph, or the hardware back button dismisses.
// Chrome (drag handle + title + close) is owned here so callers pass only the
// body and an optional footer (Apply/Reset). Frame nodes 177:1031 / 178:724.
const IN_DURATION = 260;
const OUT_DURATION = 200;
// Used to park the sheet off-screen before its height is measured (first open)
// and as a slide distance fallback; any value past the real height works.
const FALLBACK_OFFSET = 700;

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function BottomSheet({ visible, onClose, title, footer, children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  // `rendered` keeps the Modal mounted through the closing animation; it flips
  // off only once the slide-out finishes.
  const [rendered, setRendered] = useState(visible);
  const sheetHeight = useRef(0);
  // Lazy-init Animated values (stable, never re-created) without a ref read.
  const [translateY] = useState(() => new Animated.Value(FALLBACK_OFFSET));
  const [fade] = useState(() => new Animated.Value(0));

  const animateIn = useCallback(() => {
    translateY.setValue(sheetHeight.current || FALLBACK_OFFSET);
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: IN_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: IN_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, translateY]);

  const animateOut = useCallback(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 0,
        duration: OUT_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: sheetHeight.current || FALLBACK_OFFSET,
        duration: OUT_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setRendered(false);
    });
  }, [fade, translateY]);

  // Mount the Modal as soon as we're asked to open (React-blessed
  // adjust-state-during-render — the slide-out unmounts it later).
  if (visible && !rendered) setRendered(true);

  // Drive the slide from `visible` edges so a re-open animates immediately when
  // the height is already known, and the first open animates from onLayout.
  const wasVisible = useRef(visible);
  useEffect(() => {
    const was = wasVisible.current;
    wasVisible.current = visible;
    if (visible && !was) {
      if (sheetHeight.current > 0) animateIn();
    } else if (!visible && was) {
      animateOut();
    }
  }, [visible, animateIn, animateOut]);

  const onSheetLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const height = e.nativeEvent.layout.height;
      if (height <= 0) return;
      const firstMeasure = sheetHeight.current === 0;
      sheetHeight.current = height;
      if (firstMeasure && visible) animateIn();
    },
    [animateIn, visible],
  );

  if (!rendered) return null;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.scrim, { opacity: fade }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
        </Animated.View>
        <Animated.View
          onLayout={onSheetLayout}
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + theme.spacing.lg,
              opacity: fade,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <View style={styles.header}>
            <Text variant="h2" color={theme.colors.text.primary}>
              {title}
            </Text>
            <IconButton
              variant="ghost"
              onPress={onClose}
              accessibilityLabel="Close"
              icon={<X size={20} color={theme.colors.text.primary} />}
            />
          </View>
          {children}
          {footer}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.scrim,
  },
  sheet: {
    backgroundColor: theme.colors.surface.raised,
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.lg,
    ...theme.shadows.overlay,
  },
  handleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.text.disabled,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
