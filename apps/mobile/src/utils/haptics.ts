import { Vibration } from "react-native";

/**
 * Trigger a light haptic feedback.
 * Uses Vibration API (no extra dependency).
 * Silently fails on devices that don't support it.
 */
export function hapticLight() {
  try {
    Vibration.vibrate(10);
  } catch {
    // Device doesn't support haptics — no-op
  }
}

/**
 * Trigger a medium haptic feedback (trade confirm, important actions).
 */
export function hapticMedium() {
  try {
    Vibration.vibrate(25);
  } catch {
    // no-op
  }
}
