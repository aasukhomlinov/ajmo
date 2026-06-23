import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { theme } from '@/lib/theme';

import { PageDots } from './PageDots';

// Event-detail cover gallery — horizontal paging of edge-to-edge poster images
// (4:5 per DS), with the lime active indicator via PageDots. Image placeholder =
// surface/raised. Screen-level chrome (top scrim, back/like/share IconButtons)
// is overlaid by the Event Detail screen, not baked in here.
//
// DS: "ajmo DS" / Carousel. The DS node id isn't resolvable via the MCP
// page-lister in this file, so this is built from the published component
// description + the Cover image treatment, per the manual Code-Connect rule.
const POSTER_RATIO = 4 / 5;

export interface CarouselProps {
  /** Edge-to-edge poster image URLs. Empty renders a single placeholder poster. */
  images: string[];
  /** Poster aspect ratio (w/h). Defaults to the DS 4:5 poster. */
  aspectRatio?: number;
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  style?: StyleProp<ViewStyle>;
}

export function Carousel({
  images,
  aspectRatio = POSTER_RATIO,
  initialIndex = 0,
  onIndexChange,
  style,
}: CarouselProps) {
  const [width, setWidth] = useState(Dimensions.get('window').width);
  const [index, setIndex] = useState(initialIndex);
  const scrollRef = useRef<ScrollView>(null);

  // Always at least one slide so a no-image event still shows the placeholder.
  const slides = images.length > 0 ? images : [undefined];

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next > 0 && next !== width) {
      setWidth(next);
      // Keep the current page aligned after a width change (e.g. rotation).
      scrollRef.current?.scrollTo({ x: index * next, animated: false });
    }
  };

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) {
      setIndex(next);
      onIndexChange?.(next);
    }
  };

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        contentOffset={{ x: initialIndex * width, y: 0 }}
      >
        {slides.map((uri, slideIndex) => (
          <View key={slideIndex} style={{ width, aspectRatio }}>
            {uri ? (
              <Image
                source={{ uri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
              />
            ) : null}
          </View>
        ))}
      </ScrollView>

      {slides.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          <PageDots count={slides.length} activeIndex={index} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: theme.colors.surface.raised,
  },
  dots: {
    position: 'absolute',
    bottom: theme.spacing.lg,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
