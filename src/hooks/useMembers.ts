"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type {
  MemberAttendanceSummary,
  Tables,
  Database,
} from "@/types/database";

const DEFAULT_ROLE_PRIORITY = 100;

function normalizeStatus(status?: string | null) {
  return status?.toLowerCase().trim() ?? "";
}

function getMemberRolePriority(member: MemberAttendanceSummary) {
  const status = normalizeStatus(member.status);

  if (!status) {
    return DEFAULT_ROLE_PRIORITY;
  }

  if (status.includes("past") && status.includes("chair")) return 6;
  if (status.includes("vice") && status.includes("chair")) return 1;
  if (status.includes("chairman")) return 0;
  if (status.includes("secretary")) return 2;
  if (status.includes("treasurer")) return 3;
  if (status.includes("iro") || status.includes("public relations")) return 4;
  if (status.includes("csr")) return 5;
  if (status.includes("sergeant")) return 7;

  return DEFAULT_ROLE_PRIORITY;
}

function parseMemberNumber(memberNumber?: string | null) {
  if (!memberNumber) return null;
  const numericFragment = memberNumber.match(/\d+/);
  if (!numericFragment) return null;
  const parsed = Number.parseInt(numericFragment[0], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function getMemberNumberPriority(member: MemberAttendanceSummary) {
  const parsed = parseMemberNumber(member.member_number);
  if (parsed === null) {
    return Number.POSITIVE_INFINITY;
  }
  return parsed;
}

export function sortMembersByHierarchy(
  members: MemberAttendanceSummary[],
): MemberAttendanceSummary[] {
  return [...members].sort((a, b) => {
    const rolePriorityDiff =
      getMemberRolePriority(a) - getMemberRolePriority(b);

    if (rolePriorityDiff !== 0) {
      return rolePriorityDiff;
    }

    const numberPriorityDiff =
      getMemberNumberPriority(a) - getMemberNumberPriority(b);

    if (numberPriorityDiff !== 0) {
      return numberPriorityDiff;
    }

    if (a.join_date && b.join_date) {
      const dateDiff =
        new Date(a.join_date).getTime() - new Date(b.join_date).getTime();
      if (dateDiff !== 0) {
        return dateDiff;
      }
    } else if (a.join_date) {
      return -1;
    } else if (b.join_date) {
      return 1;
    }

    return a.full_name.localeCompare(b.full_name);
  });
}

export type MemberFormValues = {
  full_name: string;
  email: string;
  phone?: string | null;
  member_number?: string | null;
  join_date: string;
  status: string;
};

type UseMembersState = {
  members: MemberAttendanceSummary[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  updatingId: string | null;
};

const initialState: UseMembersState = {
  members: [],
  loading: true,
  error: null,
  creating: false,
  updatingId: null,
};

export function useMembers() {
  const [state, setState] = useState<UseMembersState>(initialState);

  const setPartialState = useCallback(
    (partial: Partial<UseMembersState>) => {
      setState((prev) => ({ ...prev, ...partial }));
    },
    []
  );

  const fetchMembers = useCallback(
    async (options?: { silently?: boolean }) => {
      if (!options?.silently) {
        setPartialState({ loading: true, error: null });
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("member_attendance_summary")
          .select("*")
          .order("full_name", { ascending: true })
          .returns<MemberAttendanceSummary[]>();

        if (error) {
          throw error;
        }

        setPartialState({
          members: sortMembersByHierarchy(data ?? []),
          error: null,
        });
      } catch (error) {
        console.error("Failed to fetch members", error);
        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to load member information.",
        });
      } finally {
        if (!options?.silently) {
          setPartialState({ loading: false });
        }
      }
    },
    [setPartialState]
  );

  const createMember = useCallback(
    async (values: MemberFormValues) => {
      setPartialState({ creating: true, error: null });
      try {
        const supabase = getSupabaseBrowserClient();
        const payload: Tables["members"]["Insert"] = {
          full_name: values.full_name,
          email: values.email,
          join_date: values.join_date,
          status: values.status,
          phone: values.phone ?? null,
          member_number: values.member_number ?? null,
        };

        const { error } = await supabase.from("members").insert(payload);

        if (error) {
          throw new Error(
            error.message ||
              "Supabase rejected the request while creating a member.",
          );
        }

        await fetchMembers({ silently: true });
      } catch (error) {
        console.error("Failed to create member", error);
        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to create member. Please try again.",
        });
        throw error instanceof Error
          ? error
          : new Error("Unable to create member. Please try again.");
      } finally {
        setPartialState({ creating: false });
      }
    },
    [fetchMembers, setPartialState]
  );

  const updateMember = useCallback(
    async (id: string, values: MemberFormValues) => {
      setPartialState({ updatingId: id, error: null });

      try {
        const supabase = getSupabaseBrowserClient();
        const payload: Tables["members"]["Update"] = {
          full_name: values.full_name,
          email: values.email,
          phone: values.phone ?? null,
          member_number: values.member_number ?? null,
          join_date: values.join_date,
          status: values.status,
        };

        const { error } = await supabase
          .from("members")
          .update(payload)
          .eq("id", id);

        if (error) {
          throw new Error(
            error.message ||
              "Supabase rejected the request while updating a member.",
          );
        }

        await fetchMembers({ silently: true });
      } catch (error) {
        console.error("Failed to update member", error);
        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to update member. Please try again.",
        });
        throw error instanceof Error
          ? error
          : new Error("Unable to update member. Please try again.");
      } finally {
        setPartialState({ updatingId: null });
      }
    },
    [fetchMembers, setPartialState]
  );

  useEffect(() => {
    let isMounted = true;
    let channel: RealtimeChannel | null = null;
    let supabaseInstance: SupabaseClient<Database> | null = null;

    void fetchMembers();

    try {
      supabaseInstance = getSupabaseBrowserClient();
      const handleRealtimeUpdate = () => {
        if (isMounted) {
          void fetchMembers({ silently: true });
        }
      };

      channel = supabaseInstance
        .channel("members-live-updates")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "members" },
          handleRealtimeUpdate
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "attendance" },
          handleRealtimeUpdate
        )
        .subscribe();
    } catch (error) {
      console.error("Failed to subscribe to member updates", error);
      setPartialState({
        error:
          error instanceof Error
            ? error.message
            : "Unable to subscribe to live updates.",
      });
    }

    return () => {
      isMounted = false;
      if (channel && supabaseInstance) {
        supabaseInstance.removeChannel(channel);
      }
    };
  }, [fetchMembers, setPartialState]);

  return useMemo(
    () => ({
      members: state.members,
      loading: state.loading,
      error: state.error,
      creating: state.creating,
      updatingId: state.updatingId,
      refresh: () => fetchMembers(),
      createMember,
      updateMember,
    }),
    [
      state.members,
      state.loading,
      state.error,
      state.creating,
      state.updatingId,
      fetchMembers,
      createMember,
      updateMember,
    ]
  );
}

