import type { User } from "@supabase/supabase-js";

type AppleFullName = {
  givenName?: string | null;
  middleName?: string | null;
  familyName?: string | null;
};

/** Build a display name from native Sign in with Apple credential (first sign-in only). */
export function formatAppleCredentialName(fullName: AppleFullName | null): string {
  if (!fullName) return "";
  const parts = [fullName.givenName, fullName.middleName, fullName.familyName].filter(
    (part): part is string => Boolean(part?.trim()),
  );
  return parts.join(" ").trim();
}

function readAppleIdentityName(user: User): string {
  const appleIdentity = user.identities?.find((identity) => identity.provider === "apple");
  const data = appleIdentity?.identity_data as Record<string, unknown> | undefined;
  if (!data) return "";

  const direct = String(data.full_name ?? data.name ?? "").trim();
  if (direct) return direct;

  const given = String(data.given_name ?? data.givenName ?? "").trim();
  const family = String(data.family_name ?? data.familyName ?? "").trim();
  return [given, family].filter(Boolean).join(" ").trim();
}

/**
 * Resolve the best available full name for a user.
 * Priority: profile row → auth metadata → Apple identity payload.
 */
export function resolveDisplayFullName(
  user: User | null,
  profileFullName?: string | null,
): string {
  const fromProfile = profileFullName?.trim();
  if (fromProfile) return fromProfile;

  if (!user) return "";

  const fromMetadata = String(
    user.user_metadata?.full_name ?? user.user_metadata?.name ?? "",
  ).trim();
  if (fromMetadata) return fromMetadata;

  return readAppleIdentityName(user);
}

/** First name for greetings; never falls back to email local-part. */
export function resolveFirstName(
  user: User | null,
  profileFullName?: string | null,
): string {
  const fullName = resolveDisplayFullName(user, profileFullName);
  if (!fullName) return "";
  return fullName.split(/\s+/)[0] ?? "";
}
