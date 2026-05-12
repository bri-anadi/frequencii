import { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

const SCREEN_HEIGHT = Dimensions.get("window").height;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Height as fraction of screen height, default 0.7 */
  heightFraction?: number;
}

export function BottomSheet({
  visible,
  onClose,
  children,
  heightFraction = 0.7,
}: BottomSheetProps) {
  const sheetHeight = SCREEN_HEIGHT * heightFraction;
  const translateY = useRef(new Animated.Value(sheetHeight)).current;
  const dragY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      dragY.setValue(0);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: sheetHeight,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, sheetHeight, translateY, dragY]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 8,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          dragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > sheetHeight * 0.5 || gestureState.vy > 0.8) {
          onClose();
        } else {
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  return (
    <Modal
      animationType="none"
      statusBarTranslucent
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            { height: sheetHeight },
            { transform: [{ translateY: Animated.add(translateY, dragY) }] },
          ]}
        >
          <View {...panResponder.panHandlers} style={styles.handleArea}>
            <View style={styles.handle} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  handle: {
    backgroundColor: "#3c4c34",
    borderRadius: 3,
    height: 4,
    width: 40,
  },
  handleArea: {
    alignItems: "center",
    paddingBottom: 8,
    paddingTop: 12,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0c100b",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
  },
});
