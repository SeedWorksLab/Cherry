import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

interface RecordingWavesProps {
  level: number;
  active: boolean;
  size: number;
  color: string;
}

const BAR_COUNT = 28;
const BAR_WIDTH = 3;
const BAR_HEIGHT = 12;
const EXTENT = 28;

const BAR_PATTERN = [
  1.05, 0.7, 0.95, 0.6, 1.15, 0.8, 1.0, 0.65, 1.1, 0.75, 1.2, 0.85, 1.0, 0.7,
  1.05, 0.9, 1.15, 0.7, 0.95, 0.8, 1.1, 0.65, 1.2, 0.75, 1.0, 0.85, 1.05, 0.7,
];

const ANGLES = Array.from({ length: BAR_COUNT }, (_, index) => (360 / BAR_COUNT) * index);

export function RecordingWaves({ level, active, size, color }: RecordingWavesProps) {
  const [animatedLevel] = useState(() => new Animated.Value(0));
  const [ripple] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(animatedLevel, {
      toValue: active ? Math.min(1, Math.max(0, level)) : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 90,
    }).start();
  }, [active, level, animatedLevel]);

  useEffect(() => {
    if (!active) {
      ripple.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(ripple, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => {
      loop.stop();
      ripple.setValue(0);
    };
  }, [active, ripple]);

  const box = size + EXTENT * 2;
  const barOffset = -(size / 2 + 8);
  const rippleScale = ripple.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const rippleOpacity = ripple.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  const bars = useMemo(
    () =>
      ANGLES.map((angle, index) => {
        const scale = animatedLevel.interpolate({
          inputRange: [0, 1],
          outputRange: [0.35, 0.35 + BAR_PATTERN[index] * 2.6],
        });
        return (
          <Animated.View
            key={angle}
            style={[
              styles.bar,
              {
                backgroundColor: color,
                transform: [
                  { rotate: `${angle}deg` },
                  { translateY: barOffset },
                  { scaleY: scale },
                ],
              },
            ]}
          />
        );
      }),
    [animatedLevel, barOffset, color]
  );

  return (
    <View pointerEvents="none" style={[styles.container, { width: box, height: box }]}>
      <Animated.View
        style={[
          styles.ripple,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            opacity: rippleOpacity,
            transform: [{ scale: rippleScale }],
          },
        ]}
      />
      {bars}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: BAR_WIDTH / 2,
  },
  ripple: {
    position: 'absolute',
    borderWidth: 2,
  },
});
