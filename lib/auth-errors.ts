import { isNetworkRequestFailure } from "@/lib/network-errors";

/** True when the server no longer recognizes the persisted refresh token. */
export function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error) return false;

  const message =
    error instanceof Error
      ? error.message
      : String((error as { message?: string })?.message ?? error);

  return /invalid refresh token|refresh token not found|refresh_token_not_found|session_not_found|user session missing/i.test(
    message,
  );
}

export function isRecoverableAuthNetworkError(error: unknown): boolean {
  if (!error) return false;
  if (isInvalidRefreshTokenError(error)) return false;
  if (error instanceof Error && error.message === "getUser timeout") return true;
  return isNetworkRequestFailure(error);
}
