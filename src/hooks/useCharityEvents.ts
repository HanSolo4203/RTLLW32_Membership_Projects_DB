"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type {
  CharityEvent,
  CharityEventInsert,
  CharityEventUpdate,
  Database,
} from "@/types/database";

export type CharityEventFormValues = {
  event_name: string;
  event_date: string;
  description?: string | null;
  participant_member_ids?: string[];
  participant_pipeliner_ids?: string[];
};

type UseCharityEventsState = {
  events: CharityEvent[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  updatingId: string | null;
};

const initialState: UseCharityEventsState = {
  events: [],
  loading: true,
  error: null,
  creating: false,
  updatingId: null,
};

function normalizeCharityEventPayload(values: CharityEventFormValues): CharityEventInsert {
  const participantIds = [
    ...(values.participant_member_ids ?? []),
    ...(values.participant_pipeliner_ids ?? []),
  ].filter(Boolean);

  const uniqueParticipants = Array.from(new Set(participantIds));

  return {
    event_name: values.event_name.trim(),
    event_date: values.event_date,
    description: values.description?.trim() || null,
    participant_ids: uniqueParticipants.length > 0 ? uniqueParticipants : null,
  };
}

export function useCharityEvents() {
  const [state, setState] = useState<UseCharityEventsState>(initialState);

  const setPartialState = useCallback((partial: Partial<UseCharityEventsState>) => {
    setState((previous) => ({ ...previous, ...partial }));
  }, []);

  const fetchEvents = useCallback(
    async (options?: { silently?: boolean }) => {
      if (!options?.silently) {
        setPartialState({ loading: true, error: null });
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("charity_events")
          .select("*")
          .order("event_date", { ascending: false });

        if (error) {
          throw error;
        }

        setPartialState({
          events: (data ?? []) as CharityEvent[],
          error: null,
        });
      } catch (error) {
        console.error("Failed to fetch charity events", error);
        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to load charity events right now.",
        });
      } finally {
        if (!options?.silently) {
          setPartialState({ loading: false });
        }
      }
    },
    [setPartialState]
  );

  const createEvent = useCallback(
    async (values: CharityEventFormValues) => {
      setPartialState({ creating: true, error: null });

      try {
        const payload = normalizeCharityEventPayload(values);
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("charity_events")
          .insert(payload)
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        await fetchEvents({ silently: true });
        return data as CharityEvent;
      } catch (error) {
        console.error("Failed to create charity event", error);
        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to create charity event. Please try again.",
        });
        throw error;
      } finally {
        setPartialState({ creating: false });
      }
    },
    [fetchEvents, setPartialState]
  );

  const updateEvent = useCallback(
    async (id: string, values: CharityEventFormValues) => {
      setPartialState({ updatingId: id, error: null });

      try {
        const payload: CharityEventUpdate = normalizeCharityEventPayload(values);
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("charity_events")
          .update(payload)
          .eq("id", id)
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        await fetchEvents({ silently: true });
        return data as CharityEvent;
      } catch (error) {
        console.error("Failed to update charity event", error);
        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to update charity event. Please try again.",
        });
        throw error;
      } finally {
        setPartialState({ updatingId: null });
      }
    },
    [fetchEvents, setPartialState]
  );

  useEffect(() => {
    let isMounted = true;
    let channel: RealtimeChannel | null = null;
    let supabaseInstance: SupabaseClient<Database> | null = null;

    void fetchEvents();

    try {
      supabaseInstance = getSupabaseBrowserClient();
      const handleRealtimeUpdate = () => {
        if (isMounted) {
          void fetchEvents({ silently: true });
        }
      };

      channel = supabaseInstance
        .channel("charity-events-live-updates")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "charity_events" },
          handleRealtimeUpdate
        )
        .subscribe();
    } catch (error) {
      console.error("Failed to subscribe to charity event updates", error);
      setPartialState({
        error:
          error instanceof Error
            ? error.message
            : "Unable to subscribe to charity event updates.",
      });
    }

    return () => {
      isMounted = false;
      if (channel && supabaseInstance) {
        supabaseInstance.removeChannel(channel);
      }
    };
  }, [fetchEvents, setPartialState]);

  const eventsById = useMemo(() => {
    const map = new Map<string, CharityEvent>();
    state.events.forEach((event) => map.set(event.id, event));
    return map;
  }, [state.events]);

  return useMemo(
    () => ({
      events: state.events,
      eventsById,
      loading: state.loading,
      error: state.error,
      creating: state.creating,
      updatingId: state.updatingId,
      refresh: () => fetchEvents(),
      createEvent,
      updateEvent,
    }),
    [
      createEvent,
      eventsById,
      fetchEvents,
      state.creating,
      state.error,
      state.events,
      state.loading,
      state.updatingId,
      updateEvent,
    ]
  );
}


