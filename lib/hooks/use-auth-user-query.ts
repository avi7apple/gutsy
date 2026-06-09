import { shouldRetryQuery } from "@/lib/network-errors";
import { supabase } from "@/lib/supabase";
import { resolveDisplayFullName, resolveFirstName } from "@/lib/user-display-name";
import type { User } from "@supabase/supabase-js";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

export interface AuthUserProfile {
  user: User | null;
  firstName: string;
  fullName: string;
  avatarUrl: string | null;
  email: string | null;
  memberSince: string | null;
}

type AuthUserPayload = {
  user: User | null;
  profileFullName: string | null;
};

async function fetchAuthUser(): Promise<AuthUserPayload> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { user: null, profileFullName: null };
  }

  const { data: profileRow } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user,
    profileFullName: profileRow?.full_name ?? null,
  };
}

export function useAuthUserQuery() {
  const query = useQuery({
    queryKey: ["authUser"],
    queryFn: fetchAuthUser,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: shouldRetryQuery,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  });

  const profile = useMemo<AuthUserProfile>(() => {
    const user = query.data?.user ?? null;
    const profileFullName = query.data?.profileFullName ?? null;
    const fullName = resolveDisplayFullName(user, profileFullName);
    const firstName = resolveFirstName(user, profileFullName);
    const avatarUrl = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null;

    let memberSince: string | null = null;
    if (user?.created_at) {
      const createdDate = new Date(user.created_at);
      memberSince = createdDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }

    return {
      user,
      firstName,
      fullName,
      avatarUrl,
      email: user?.email ?? null,
      memberSince,
    };
  }, [query.data]);

  return {
    ...query,
    profile,
    user: profile.user,
  };
}
