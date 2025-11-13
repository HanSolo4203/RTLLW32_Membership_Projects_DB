"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { fetchMembershipStats, type MembershipStats } from "@/lib/membershipStats";

export type { MembershipStats } from "@/lib/membershipStats";

type UseMembershipStatsState = {
  stats: MembershipStats | null;
  loading: boolean;
  error: string | null;
};

const initialState: UseMembershipStatsState = {
  stats: null,
  loading: true,
  error: null,
};

export function useMembershipStats(month: string) {
  const [state, setState] = useState<UseMembershipStatsState>(initialState);

  const setPartialState = useCallback((partial: Partial<UseMembershipStatsState>) => {
    setState((previous) => ({ ...previous, ...partial }));
  }, []);

  const fetchStats = useCallback(
    async (options?: { silently?: boolean }) => {
      if (!options?.silently) {
        setPartialState({ loading: true, error: null });
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const stats = await fetchMembershipStats(supabase, month);

        setPartialState({ stats, error: null });
      } catch (error) {
        console.error("Failed to fetch membership stats", error);

        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to load membership statistics right now.",
        });
      } finally {
        if (!options?.silently) {
          setPartialState({ loading: false });
        }
      }
    },
    [month, setPartialState],
  );

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  return useMemo(
    () => ({
      stats: state.stats,
      loading: state.loading,
      error: state.error,
      refetch: () => fetchStats({ silently: false }),
    }),
    [fetchStats, state.error, state.loading, state.stats],
  );
}


