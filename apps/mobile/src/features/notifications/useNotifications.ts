import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { apiRequest } from "../../api/client";

const PUSH_TOKEN_KEY = "frequencii_push_token";
const PERMISSION_KEY = "frequencii_push_permission";

export type NotificationStatus = "active" | "disabled" | "undetermined" | "denied";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority?.HIGH,
  } as Notifications.NotificationBehavior),
});

export function useNotifications(token: string | null) {
  const [status, setStatus] = useState<NotificationStatus>("undetermined");
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  // Check current permission status
  const checkStatus = useCallback(async () => {
    const stored = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
    if (stored) {
      setPushToken(stored);
      setStatus("active");
      return;
    }

    const storedPermission = await SecureStore.getItemAsync(PERMISSION_KEY);
    if (storedPermission === "denied") {
      setStatus("denied");
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === "granted") {
      setStatus("undetermined"); // granted but not registered
    } else if (existingStatus === "denied") {
      setStatus("denied");
      await SecureStore.setItemAsync(PERMISSION_KEY, "denied");
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Request permission and register
  const requestPermission = useCallback(async () => {
    if (!Device.isDevice) {
      setError("Push notifications require a physical device.");
      return;
    }

    setError(null);

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      setStatus("denied");
      await SecureStore.setItemAsync(PERMISSION_KEY, "denied");
      return;
    }

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: undefined, // Uses app.json slug
      });
      const expoPushToken = tokenData.data;

      // Register with backend
      if (token) {
        await apiRequest("/api/v1/user/profile", {
          method: "PUT",
          token,
          body: JSON.stringify({ pushToken: expoPushToken }),
        });
      }

      await SecureStore.setItemAsync(PUSH_TOKEN_KEY, expoPushToken);
      await SecureStore.setItemAsync(PERMISSION_KEY, "granted");
      setPushToken(expoPushToken);
      setStatus("active");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Notification registration failed. Tap to retry.",
      );
    }
  }, [token]);

  // Disable notifications
  const disableNotifications = useCallback(async () => {
    if (!token || !pushToken) return;

    setError(null);
    try {
      await apiRequest("/api/v1/user/profile", {
        method: "PUT",
        token,
        body: JSON.stringify({ pushToken: null }),
      });
      await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
      setPushToken(null);
      setStatus("disabled");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to disable notifications. Try again.",
      );
    }
  }, [pushToken, token]);

  // Set up notification channel for Android
  useEffect(() => {
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "Frequencii",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#d4ff62",
      });
    }
  }, []);

  // Listen for notification responses (deep linking)
  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // Notification received while app is in foreground — handled by handler above
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as {
          type?: string;
          marketId?: string;
          positionId?: string;
          contactAddress?: string;
        };

        // Return navigation target for the app to handle
        if (data.type) {
          onNotificationTap?.(data);
        }
      },
    );

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return {
    disableNotifications,
    error,
    pushToken,
    requestPermission,
    status,
  };
}

// Callback for notification tap — set externally by App
let onNotificationTap: ((data: Record<string, unknown>) => void) | null = null;

export function setNotificationTapHandler(
  handler: (data: Record<string, unknown>) => void,
) {
  onNotificationTap = handler;
}
