"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  BUSINESS_MEETING_TARGET,
  CHARITY_EVENT_TARGET,
  getPipelinerBusinessMeetingCount,
  getPipelinerCharityEventCount,
  hasMetMembershipRequirements,
} from "@/lib/pipelinerEligibility";
import type {
  Database,
  MemberInsert,
  Pipeliner,
  PipelinerEligibility,
  PipelinerInsert,
  PipelinerUpdate,
} from "@/types/database";

export type PipelinerFormValues = {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  promoted_from_guest_date?: string | null;
  guest_meetings_count?: number | null;
  business_meetings_count?: number | null;
  charity_events_count?: number | null;
  is_eligible_for_membership?: boolean | null;
  status?: Pipeliner["status"];
  sponsored_by?: string | null;
  notes?: string | null;
};

export type PromotePipelinerToMemberPayload = {
  member_number: string;
  join_date: string;
};

type UsePipelinersState = {
  pipeliners: PipelinerEligibility[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  processingId: string | null;
  promotingId: string | null;
};

const initialState: UsePipelinersState = {
  pipeliners: [],
  loading: true,
  error: null,
  creating: false,
  processingId: null,
  promotingId: null,
};

function normalizePipelinerPayload(values: PipelinerFormValues): PipelinerInsert {
  return {
    full_name: values.full_name.trim(),
    email: values.email?.trim() || null,
    phone: values.phone?.trim() || null,
    promoted_from_guest_date: values.promoted_from_guest_date || null,
    guest_meetings_count: values.guest_meetings_count ?? 3,
    business_meetings_count: values.business_meetings_count ?? 0,
    charity_events_count: values.charity_events_count ?? 0,
    is_eligible_for_membership: values.is_eligible_for_membership ?? false,
    status: values.status ?? "active",
    sponsored_by: values.sponsored_by || null,
    notes: values.notes?.trim() || null,
  };
}

export function usePipeliners() {
  const [state, setState] = useState<UsePipelinersState>(initialState);

  const setPartialState = useCallback(
    (
      partial:
        | Partial<UsePipelinersState>
        | ((previous: UsePipelinersState) => Partial<UsePipelinersState>),
    ) => {
      setState((previous) => ({
        ...previous,
        ...(typeof partial === "function" ? partial(previous) : partial),
      }));
    },
    [],
  );

  const fetchPipeliners = useCallback(
    async (options?: { silently?: boolean }) => {
      if (!options?.silently) {
        setPartialState({ loading: true, error: null });
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("pipeliner_eligibility")
          .select("*")
          .order("full_name", { ascending: true })
          .returns<PipelinerEligibility[]>();

        if (error) {
          throw error;
        }

        const normalized = (data ?? []).map((pipeliner) => ({
          ...pipeliner,
          meets_requirements: hasMetMembershipRequirements(pipeliner),
        }));

        setPartialState({
          pipeliners: normalized,
          error: null,
        });
      } catch (error) {
        console.error("Failed to fetch pipeliners", error);
        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to load pipeliners right now.",
        });
      } finally {
        if (!options?.silently) {
          setPartialState({ loading: false });
        }
      }
    },
    [setPartialState]
  );

  const createPipeliner = useCallback(
    async (values: PipelinerFormValues) => {
      setPartialState({ creating: true, error: null });

      try {
        const payload = normalizePipelinerPayload(values);
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("pipeliners")
          .insert(payload)
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        await fetchPipeliners({ silently: true });
        return data as Pipeliner;
      } catch (error) {
        console.error("Failed to create pipeliner", error);
        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to create pipeliner. Please try again.",
        });
        throw error;
      } finally {
        setPartialState({ creating: false });
      }
    },
    [fetchPipeliners, setPartialState]
  );

  const updatePipeliner = useCallback(
    async (id: string, values: PipelinerFormValues) => {
      setPartialState({ processingId: id, error: null });

      try {
        const payload: PipelinerUpdate = normalizePipelinerPayload(values);

        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("pipeliners")
          .update(payload)
          .eq("id", id)
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        await fetchPipeliners({ silently: true });
        return data as Pipeliner;
      } catch (error) {
        console.error("Failed to update pipeliner", error);
        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to update pipeliner. Please try again.",
        });
        throw error;
      } finally {
        setPartialState({ processingId: null });
      }
    },
    [fetchPipeliners, setPartialState]
  );

  const deletePipeliner = useCallback(
    async (id: string) => {
      setPartialState({ processingId: id, error: null });

      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.from("pipeliners").delete().eq("id", id);

        if (error) {
          throw error;
        }

        setPartialState((previous) => ({
          pipeliners: previous.pipeliners.filter((pipeliner) => pipeliner.id !== id),
        }));
      } catch (error) {
        console.error("Failed to delete pipeliner", error);
        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to delete pipeliner. Please try again.",
        });
        throw error;
      } finally {
        setPartialState({ processingId: null });
      }
    },
    [setPartialState]
  );

  const promotePipelinerToMember = useCallback(
    async (pipelinerId: string, payload: PromotePipelinerToMemberPayload) => {
      const pipeliner = state.pipeliners.find((item) => item.id === pipelinerId);
      if (!pipeliner) {
        throw new Error("Pipeliner not found.");
      }

      const businessMeetingsCompleted =
        getPipelinerBusinessMeetingCount(pipeliner);
      const charityEventsCompleted = getPipelinerCharityEventCount(pipeliner);

      const meetsRequirements =
        hasMetMembershipRequirements(pipeliner) ||
        pipeliner.is_eligible_for_membership === true;

      if (!meetsRequirements) {
        const missingBusiness =
          businessMeetingsCompleted < BUSINESS_MEETING_TARGET
            ? `${BUSINESS_MEETING_TARGET - businessMeetingsCompleted} more business meeting(s)`
            : null;
        const missingCharity =
          charityEventsCompleted < CHARITY_EVENT_TARGET
            ? `${CHARITY_EVENT_TARGET - charityEventsCompleted} more charity event(s)`
            : null;
        const missing = [missingBusiness, missingCharity]
          .filter(Boolean)
          .join(" and ");
        throw new Error(
          missing
            ? `Pipeliner still needs ${missing} before promotion.`
            : "Pipeliner has not yet met the membership requirements.",
        );
      }

      if (!payload.member_number.trim()) {
        throw new Error("Member number is required.");
      }

      if (!payload.join_date) {
        throw new Error("Join date is required.");
      }

      if (!pipeliner.email) {
        throw new Error("Email address is required before promoting to member.");
      }

      setPartialState({ promotingId: pipelinerId, error: null });

      try {
        const supabase = getSupabaseBrowserClient();

        const memberPayload: MemberInsert = {
          full_name: pipeliner.full_name,
          email: pipeliner.email,
          phone: pipeliner.phone ?? null,
          member_number: payload.member_number.trim(),
          join_date: payload.join_date,
          status: "active",
        };

        const { data: member, error: memberError } = await supabase
          .from("members")
          .insert(memberPayload)
          .select("id")
          .single();

        if (memberError) {
          throw memberError;
        }

        const { error: pipelinerUpdateError } = await supabase
          .from("pipeliners")
          .update({
            status: "became_member",
            is_eligible_for_membership: false,
          })
          .eq("id", pipelinerId);

        if (pipelinerUpdateError) {
          if (member?.id) {
            await supabase.from("members").delete().eq("id", member.id);
          }
          throw pipelinerUpdateError;
        }

        await fetchPipeliners({ silently: true });
        return member;
      } catch (error) {
        console.error("Failed to promote pipeliner to member", error);
        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to promote pipeliner right now.",
        });
        throw error;
      } finally {
        setPartialState({ promotingId: null });
      }
    },
    [fetchPipeliners, setPartialState, state.pipeliners]
  );

  useEffect(() => {
    let isMounted = true;
    let channel: RealtimeChannel | null = null;
    let supabaseInstance: SupabaseClient<Database> | null = null;

    void fetchPipeliners();

    try {
      supabaseInstance = getSupabaseBrowserClient();
      const handleRealtimeUpdate = () => {
        if (isMounted) {
          void fetchPipeliners({ silently: true });
        }
      };

      channel = supabaseInstance
        .channel("pipeliners-live-updates")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "pipeliners" },
          handleRealtimeUpdate
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "attendance" },
          handleRealtimeUpdate
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "charity_events" },
          handleRealtimeUpdate
        )
        .subscribe();
    } catch (error) {
      console.error("Failed to subscribe to pipeliner updates", error);
      setPartialState({
        error:
          error instanceof Error
            ? error.message
            : "Unable to subscribe to pipeliner updates.",
      });
    }

    return () => {
      isMounted = false;
      if (channel && supabaseInstance) {
        supabaseInstance.removeChannel(channel);
      }
    };
  }, [fetchPipeliners, setPartialState]);

  const pipelinersById = useMemo(() => {
    const map = new Map<string, PipelinerEligibility>();
    state.pipeliners.forEach((pipeliner) => map.set(pipeliner.id, pipeliner));
    return map;
  }, [state.pipeliners]);

  return useMemo(
    () => ({
      pipeliners: state.pipeliners,
      pipelinersById,
      loading: state.loading,
      error: state.error,
      creating: state.creating,
      processingId: state.processingId,
      promotingId: state.promotingId,
      refresh: () => fetchPipeliners(),
      createPipeliner,
      updatePipeliner,
      deletePipeliner,
      promotePipelinerToMember,
    }),
    [
      createPipeliner,
      deletePipeliner,
      fetchPipeliners,
      pipelinersById,
      promotePipelinerToMember,
      state.creating,
      state.error,
      state.loading,
      state.pipeliners,
      state.processingId,
      state.promotingId,
      updatePipeliner,
    ]
  );
}


