"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { endOfDay, format, isAfter, isBefore, isWithinInterval, parseISO, startOfDay } from "date-fns";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { Database, Meeting, MeetingInsert, MeetingUpdate } from "@/types/database";

export const MEETING_TYPES = [
  { value: "business", label: "Business Meeting" },
  { value: "charity", label: "Charity Event" },
  { value: "special", label: "Special" },
] as const;

export type MeetingTypeValue = (typeof MEETING_TYPES)[number]["value"];

export type MeetingFormValues = {
  meeting_date: string;
  location?: string;
  meeting_type: MeetingTypeValue;
  notes?: string;
};

export type MeetingAttendanceSummary = {
  total: number;
  present: number;
  apology: number;
  absent: number;
};

export type MeetingRecord = Meeting & {
  attendanceSummary: MeetingAttendanceSummary;
};

type UseMeetingsState = {
  meetings: MeetingRecord[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  processingId: string | null;
};

const initialState: UseMeetingsState = {
  meetings: [],
  loading: true,
  error: null,
  creating: false,
  processingId: null,
};

const currentUtcYear = new Date().getUTCFullYear();
const RANGE_START = startOfDay(new Date(Date.UTC(currentUtcYear, 0, 1)));
const RANGE_END = endOfDay(new Date(Date.UTC(currentUtcYear + 1, 11, 31)));

export const MEETING_WINDOW = { start: RANGE_START, end: RANGE_END };

function coerceMeeting(meeting: Meeting): MeetingRecord {
  return {
    ...meeting,
    attendanceSummary: {
      total: 0,
      present: 0,
      apology: 0,
      absent: 0,
    },
  };
}

function mergeAttendanceSummaries(
  meetings: MeetingRecord[],
  summaries: Record<string, MeetingAttendanceSummary>
) {
  return meetings.map((meeting) => ({
    ...meeting,
    attendanceSummary: summaries[meeting.id] ?? meeting.attendanceSummary,
  }));
}

export function useMeetings() {
  const [state, setState] = useState<UseMeetingsState>(initialState);

  const setPartialState = useCallback(
    (
      partial:
        | Partial<UseMeetingsState>
        | ((previous: UseMeetingsState) => Partial<UseMeetingsState>),
    ) => {
      setState((prev) => ({
        ...prev,
        ...(typeof partial === "function" ? partial(prev) : partial),
      }));
    },
    [],
  );

  const enrichAttendance = useCallback(
    async (records: MeetingRecord[]): Promise<MeetingRecord[]> => {
      if (records.length === 0) {
        return records;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("attendance")
          .select("meeting_id, status")
          .in(
            "meeting_id",
            records.map((meeting) => meeting.id)
          );

        if (error) {
          throw error;
        }

        const summaries = (data ?? []).reduce<Record<string, MeetingAttendanceSummary>>(
          (acc, row) => {
            const existing = acc[row.meeting_id] ?? {
              total: 0,
              present: 0,
              apology: 0,
              absent: 0,
            };

            existing.total += 1;
            if (row.status === "present") {
              existing.present += 1;
            } else if (row.status === "apology") {
              existing.apology += 1;
            } else if (row.status === "absent") {
              existing.absent += 1;
            }

            acc[row.meeting_id] = existing;
            return acc;
          },
          {}
        );

        return mergeAttendanceSummaries(records, summaries);
      } catch (error) {
        console.error("Failed to load attendance summaries", error);
        return records;
      }
    },
    []
  );

  const fetchMeetings = useCallback(
    async (options?: { silently?: boolean }) => {
      if (!options?.silently) {
        setPartialState({ loading: true, error: null });
      }

      try {
        const supabase = getSupabaseBrowserClient();

        const { data, error } = await supabase
          .from("meetings")
          .select("*")
          .order("meeting_date", { ascending: true })
          .returns<Meeting[]>();

        if (error) {
          throw error;
        }

        const scopedMeetings = (data ?? [])
          .map(coerceMeeting)
          .filter((meeting) => {
            const parsed = parseISO(meeting.meeting_date);
            return isWithinInterval(parsed, { start: RANGE_START, end: RANGE_END });
          });

        const withAttendance = await enrichAttendance(scopedMeetings);

        setPartialState({
          meetings: withAttendance,
          error: null,
        });
      } catch (error) {
        console.error("Failed to fetch meetings", error);
        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to load meetings right now.",
        });
      } finally {
        if (!options?.silently) {
          setPartialState({ loading: false });
        }
      }
    },
    [enrichAttendance, setPartialState]
  );

  const createMeeting = useCallback(
    async (values: MeetingFormValues) => {
      setPartialState({ creating: true, error: null });

      try {
        const meetingDate = parseISO(values.meeting_date);
        const payload: MeetingInsert = {
          meeting_date: values.meeting_date,
          meeting_month: format(meetingDate, "MMMM"),
          meeting_year: Number.parseInt(format(meetingDate, "yyyy"), 10),
          meeting_type: values.meeting_type,
          location: values.location?.trim() || null,
          notes: values.notes?.trim() || null,
        };

        const supabase = getSupabaseBrowserClient();

        const { data, error } = await supabase
          .from("meetings")
          .insert(payload)
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        const meetingRecord = coerceMeeting(data as Meeting);
        const [withAttendance] = await enrichAttendance([meetingRecord]);

        setPartialState((prev) => ({
          meetings: [...prev.meetings, withAttendance].sort((a, b) =>
            a.meeting_date.localeCompare(b.meeting_date)
          ),
        }));

        return withAttendance;
      } catch (unknownError) {
        const message =
          unknownError &&
          typeof unknownError === "object" &&
          "message" in unknownError &&
          typeof unknownError.message === "string"
            ? unknownError.message
            : typeof unknownError === "string"
              ? unknownError
              : "Unable to create meeting. Please try again.";

        console.error("Failed to create meeting", unknownError);
        setPartialState({
          error: message,
        });
        throw new Error(message);
      } finally {
        setPartialState({ creating: false });
      }
    },
    [enrichAttendance, setPartialState]
  );

  const updateMeeting = useCallback(
    async (id: string, values: MeetingFormValues) => {
      setPartialState({ processingId: id, error: null });

      try {
        const meetingDate = parseISO(values.meeting_date);
        const payload: MeetingUpdate = {
          meeting_date: values.meeting_date,
          meeting_month: format(meetingDate, "MMMM"),
          meeting_year: Number.parseInt(format(meetingDate, "yyyy"), 10),
          meeting_type: values.meeting_type,
          location: values.location?.trim() || null,
          notes: values.notes?.trim() || null,
        };

        const supabase = getSupabaseBrowserClient();

        const { data, error } = await supabase
          .from("meetings")
          .update(payload)
          .eq("id", id)
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        const meetingRecord = coerceMeeting(data as Meeting);
        const [withAttendance] = await enrichAttendance([meetingRecord]);

        setPartialState((prev) => ({
          meetings: prev.meetings
            .map((meeting) => (meeting.id === id ? withAttendance : meeting))
            .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date)),
        }));

        return withAttendance;
      } catch (error) {
        console.error("Failed to update meeting", error);
        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to update meeting. Please try again.",
        });
        throw error;
      } finally {
        setPartialState({ processingId: null });
      }
    },
    [enrichAttendance, setPartialState]
  );

  const deleteMeeting = useCallback(
    async (id: string) => {
      setPartialState({ processingId: id, error: null });

      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.from("meetings").delete().eq("id", id);

        if (error) {
          throw error;
        }

        setPartialState((prev) => ({
          meetings: prev.meetings.filter((meeting) => meeting.id !== id),
        }));
      } catch (error) {
        console.error("Failed to delete meeting", error);
        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to delete meeting. Please try again.",
        });
        throw error;
      } finally {
        setPartialState({ processingId: null });
      }
    },
    [setPartialState]
  );

  useEffect(() => {
    let isMounted = true;
    let channel: RealtimeChannel | null = null;
    let supabaseInstance: SupabaseClient<Database> | null = null;

    void fetchMeetings();

    try {
      supabaseInstance = getSupabaseBrowserClient();

      const handleRealtimeUpdate = () => {
        if (isMounted) {
          void fetchMeetings({ silently: true });
        }
      };

      channel = supabaseInstance
        .channel("meetings-live-updates")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "meetings" },
          handleRealtimeUpdate
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "attendance" },
          handleRealtimeUpdate
        )
        .subscribe();
    } catch (error) {
      console.error("Failed to subscribe to meeting updates", error);
      setPartialState({
        error:
          error instanceof Error
            ? error.message
            : "Unable to subscribe to meeting updates.",
      });
    }

    return () => {
      isMounted = false;
      if (channel && supabaseInstance) {
        supabaseInstance.removeChannel(channel);
      }
    };
  }, [fetchMeetings, setPartialState]);

  const allMeetings = useMemo(() => state.meetings, [state.meetings]);

  const upcomingMeetings = useMemo(() => {
    const today = startOfDay(new Date());
    return state.meetings.filter((meeting) => {
      const meetingDate = startOfDay(parseISO(meeting.meeting_date));
      return isAfter(meetingDate, today) || meetingDate.getTime() === today.getTime();
    });
  }, [state.meetings]);

  const pastMeetings = useMemo(() => {
    const today = startOfDay(new Date());
    return state.meetings.filter((meeting) => {
      const meetingDate = startOfDay(parseISO(meeting.meeting_date));
      return isBefore(meetingDate, today);
    });
  }, [state.meetings]);

  return {
    meetings: state.meetings,
    loading: state.loading,
    error: state.error,
    creating: state.creating,
    processingId: state.processingId,
    getAllMeetings: () => allMeetings,
    getUpcomingMeetings: () => upcomingMeetings,
    getPastMeetings: () => pastMeetings,
    createMeeting,
    updateMeeting,
    deleteMeeting,
    refresh: () => fetchMeetings(),
  };
}


