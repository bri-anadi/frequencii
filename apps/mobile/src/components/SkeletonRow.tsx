import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

interface SkeletonRowProps {
  lines?: number;
  /** Show a trailing badge/price placeholder */
  withBadge?: boolean;
}

export function SkeletonRow({ lines = 2, withBadge = false }: SkeletonRowProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.row, { opacity }]}>
      <View style={styles.main}>
        <View style={styles.lineWide} />
        {lines >= 2 && <View style={styles.lineNarrow} />}
        {lines >= 3 && <View style={styles.lineShort} />}
      </View>
      {withBadge && <View style={styles.badge} />}
    </Animated.View>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} withBadge={i % 2 === 0} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: "#1c2618",
    borderRadius: 6,
    height: 28,
    width: 52,
  },
  lineNarrow: {
    backgroundColor: "#1c2618",
    borderRadius: 4,
    height: 12,
    marginTop: 8,
    width: "60%",
  },
  lineShort: {
    backgroundColor: "#1c2618",
    borderRadius: 4,
    height: 12,
    marginTop: 8,
    width: "35%",
  },
  lineWide: {
    backgroundColor: "#1c2618",
    borderRadius: 4,
    height: 14,
    width: "85%",
  },
  list: {
    gap: 4,
    padding: 16,
  },
  main: {
    flex: 1,
  },
  row: {
    alignItems: "center",
    borderBottomColor: "#1c2618",
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingVertical: 16,
  },
});
