import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "../config/env";

const TOKEN_STORAGE_KEY = "frequencii_mobile_jwt";
const MAX_REFRESH_RETRIES = 3;

export class ApiError extends Error {
  status: number;
  details?: string;

  constructor(status: number, message: string, details?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

// Token refresh state — shared across all requests
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;
let pendingRequests: Array<{
  resolve: (token: string) => void;
  reject: (err: Error) => void;
}> = [];

async function refreshToken(currentToken: string): Promise<string | null> {
  let attempts = 0;

  while (attempts < MAX_REFRESH_RETRIES) {
    attempts++;
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401 || response.status === 403) {
        // Token is truly expired — clear session
        return null;
      }

      if (!response.ok) {
        if (attempts >= MAX_REFRESH_RETRIES) return null;
        continue;
      }

      const data = await response.json();
      const newToken = data.token as string;
      await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, newToken);
      return newToken;
    } catch {
      if (attempts >= MAX_REFRESH_RETRIES) return null;
    }
  }

  return null;
}

function handleRefresh(token: string): Promise<string | null> {
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      pendingRequests.push({
        resolve: resolve as (token: string) => void,
        reject,
      });
    });
  }

  isRefreshing = true;
  refreshPromise = refreshToken(token)
    .then((newToken) => {
      if (newToken) {
        for (const req of pendingRequests) req.resolve(newToken);
      } else {
        const err = new Error("Session expired");
        for (const req of pendingRequests) req.reject(err);
      }
      return newToken;
    })
    .finally(() => {
      isRefreshing = false;
      refreshPromise = null;
      pendingRequests = [];
    });

  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (init.token) {
    headers.set("Authorization", `Bearer ${init.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  // Auto-refresh on 401
  if (response.status === 401 && init.token) {
    const newToken = await handleRefresh(init.token);

    if (!newToken) {
      // Clear session — caller (useMobileAuth) will detect missing token
      await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
      await SecureStore.deleteItemAsync("frequencii_mobile_user");
      throw new ApiError(401, "Session expired. Please sign in again.");
    }

    // Retry with new token
    const retryHeaders = new Headers(init.headers);
    retryHeaders.set("Accept", "application/json");
    if (init.body && !retryHeaders.has("Content-Type")) {
      retryHeaders.set("Content-Type", "application/json");
    }
    retryHeaders.set("Authorization", `Bearer ${newToken}`);

    const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: retryHeaders,
    });

    if (!retryResponse.ok) {
      const contentType = retryResponse.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const errorBody = await retryResponse.json();
        throw new ApiError(
          retryResponse.status,
          errorBody.error ?? `API request failed with ${retryResponse.status}`,
          errorBody.details,
        );
      }
      const text = await retryResponse.text();
      throw new ApiError(retryResponse.status, text || "API request failed");
    }

    if (retryResponse.status === 204) return undefined as T;
    return retryResponse.json() as Promise<T>;
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const errorBody = await response.json();
      throw new ApiError(
        response.status,
        errorBody.error ?? `API request failed with ${response.status}`,
        errorBody.details,
      );
    }

    const text = await response.text();
    throw new ApiError(response.status, text || "API request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
