import { shouldRetryQuery } from "@/lib/network-errors";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

export interface AuthUserProfile {
  user: User | null;
  firstName: string;
  avatarUrl: string | null;
  email: string | null;
  memberSince: string | null;
}

async function fetchAuthUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
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
    const user = query.data ?? null;
    const fullName = (user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "").trim();
    const firstName = fullName
      ? fullName.split(/\s+/)[0] ?? ""
      : user?.email?.split("@")[0] ?? "";
    const avatarUrl = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null;

    let memberSince: string | null = null;
    if (user?.created_at) {
      const createdDate = new Date(user.created_at);
      memberSince = createdDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }

    return {
      user,
      firstName,
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
