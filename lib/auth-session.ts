import { logOutRevenueCatUser } from "@/lib/revenuecat";
import {
  isInvalidRefreshTokenError,
  isRecoverableAuthNetworkError,
} from "./auth-errors";
import { supabase } from "./supabase";
import type { AuthError, User } from "@supabase/supabase-js";

let clearingStaleSession = false;
let recoveryListenerInstalled = false;

/**
 * Drop the local Supabase session (and RC identity) when the server-side
 * session is gone — e.g. user deleted in dashboard, account deleted elsewhere.
 */
export async function clearStaleAuthSession(): Promise<void> {
  if (clearingStaleSession) return;
  clearingStaleSession = true;

  try {
    await Promise.allSettled([
      supabase.auth.signOut({ scope: "local" }),
      logOutRevenueCatUser(),
    ]);
  } finally {
    clearingStaleSession = false;
  }
}

type ResolvedAuthUser = {
  user: User | null;
  error: AuthError | null;
};

/**
 * Resolve the current user with server validation when possible.
 * Falls back to the cached session only on network/timeout failures.
 */
export async function resolveAuthenticatedUser(): Promise<ResolvedAuthUser> {
  const { data, error } = await supabase.auth.getUser();

  if (data.user) {
    return { user: data.user, error: error ?? null };
  }

  if (error && isInvalidRefreshTokenError(error)) {
    await clearStaleAuthSession();
    return { user: null, error };
  }

  return { user: null, error: error ?? null };
}

/**
 * Install a global listener so background token refresh failures and
 * unhandled auth rejections clear ghost sessions instead of leaving the
 * app in a half-logged-in state.
 */
export function initAuthSessionRecovery(): () => void {
  if (recoveryListenerInstalled) {
    return () => {};
  }
  recoveryListenerInstalled = true;

  const { data: authListener } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (event === "SIGNED_OUT" && !session) {
        void logOutRevenueCatUser();
      }
    },
  );

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (isInvalidRefreshTokenError(event.reason)) {
      event.preventDefault?.();
      void clearStaleAuthSession();
    }
  };

  globalThis.addEventListener?.(
    "unhandledrejection",
    handleUnhandledRejection as EventListener,
  );

  void (async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.auth.getUser();
    if (error && isInvalidRefreshTokenError(error)) {
      await clearStaleAuthSession();
    }
  })();

  return () => {
    authListener.subscription.unsubscribe();
    globalThis.removeEventListener?.(
      "unhandledrejection",
      handleUnhandledRejection as EventListener,
    );
    recoveryListenerInstalled = false;
  };
}

export { isInvalidRefreshTokenError, isRecoverableAuthNetworkError };
