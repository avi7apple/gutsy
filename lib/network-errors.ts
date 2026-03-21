export function isNetworkRequestFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /network request failed|failed to fetch|network\s?error|the network connection was lost|timed out|timeout|request timeout|aborted|econnrefused|enotfound|eai_again/i.test(
    message,
  );
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isNetworkRequestFailure(error)) {
    return false;
  }

  return failureCount < 2;
}
