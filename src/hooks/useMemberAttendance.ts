"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import {
  format,
  isValid,
  parseISO,
  startOfMonth,
} from "date-fns";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type {
  Attendance,
  Database,
  MemberAttendanceSummary,
} from "@/types/database";

export type AttendanceHistoryItem = {
  id: string;
  meetingId: string;
  meetingDate: string | null;
  meetingType: string | null;
  location: string | null;
  status: Attendance["status"];
  notes: string | null;
};

type AttendanceQueryRow = {
  id: string;
  status: Attendance["status"];
  notes: string | null;
  meeting_id: string;
  meetings?:
    | {
        meeting_date: string;
        meeting_type: string;
        location: string | null;
      }
    | null;
};

export type MemberAttendanceStats = {
  totalMeetings: number;
  attended: number;
  apologies: number;
  absences: number;
  attendancePercentage: number;
  trendDelta: number | null;
};

type UseMemberAttendanceState = {
  member: MemberAttendanceSummary | null;
  history: AttendanceHistoryItem[];
  loading: boolean;
  error: string | null;
};

const initialState: UseMemberAttendanceState = {
  member: null,
  history: [],
  loading: true,
  error: null,
};

export function useMemberAttendance(memberId: string | null) {
  const [state, setState] = useState<UseMemberAttendanceState>(initialState);

  const setPartialState = useCallback(
    (partial: Partial<UseMemberAttendanceState>) => {
      setState((prev) => ({ ...prev, ...partial }));
    },
    []
  );

  const fetchAttendance = useCallback(
    async (options?: { silently?: boolean }) => {
      if (!memberId) {
        setState({ ...initialState, loading: false });
        return;
      }

      if (!options?.silently) {
        setPartialState({ loading: true, error: null });
      }

      try {
        const supabase = getSupabaseBrowserClient();

        const { data: memberData, error: memberError } = await supabase
          .from("member_attendance_summary")
          .select("*")
            .eq("id", memberId)
            .returns<MemberAttendanceSummary>()
            .single();

        if (memberError) {
          throw memberError;
        }

        const { data: attendanceData, error: attendanceError } =
          await supabase
            .from("attendance")
            .select(
              `
              id,
              status,
              notes,
              meeting_id,
              meetings!attendance_meeting_id_fkey (
                meeting_date,
                meeting_type,
                location
              )
            `
            )
            .eq("member_id", memberId)
            .order("meeting_date", {
              foreignTable: "meetings",
              ascending: false,
            })
            .returns<AttendanceQueryRow[]>();

        if (attendanceError) {
          throw attendanceError;
        }

        const history: AttendanceHistoryItem[] =
          (attendanceData ?? []).map((item) => {
            const meeting = item.meetings ?? null;

            return {
              id: item.id,
              meetingId: item.meeting_id,
              meetingDate: meeting?.meeting_date ?? null,
              meetingType: meeting?.meeting_type ?? null,
              location: meeting?.location ?? null,
              status: item.status,
              notes: item.notes ?? null,
            };
          });

        setState((prev) => ({
          ...prev,
          member: memberData ?? null,
          history,
          loading: false,
          error: null,
        }));
      } catch (error) {
        console.error("Failed to load member attendance", error);
        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to load member attendance data.",
          loading: false,
        });
      } finally {
        if (!options?.silently) {
          setPartialState({ loading: false });
        }
      }
    },
    [memberId, setPartialState]
  );

  useEffect(() => {
    if (!memberId) {
      setState({ ...initialState, loading: false });
      return;
    }

    let isMounted = true;
    let supabaseInstance: SupabaseClient<Database> | null = null;
    let channel: RealtimeChannel | null = null;

    void fetchAttendance();

    try {
      supabaseInstance = getSupabaseBrowserClient();
      const handleUpdate = () => {
        if (isMounted) {
          void fetchAttendance({ silently: true });
        }
      };

      channel = supabaseInstance
        .channel(`member-${memberId}-attendance`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "attendance" },
          handleUpdate
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "members", filter: `id=eq.${memberId}` },
          handleUpdate
        )
        .subscribe();
    } catch (error) {
      console.error("Failed to subscribe to attendance updates", error);
      setPartialState({
        error:
          error instanceof Error
            ? error.message
            : "Unable to subscribe to live attendance updates.",
      });
    }

    return () => {
      isMounted = false;
      if (channel && supabaseInstance) {
        supabaseInstance.removeChannel(channel);
      }
    };
  }, [memberId, fetchAttendance, setPartialState]);

  const trendData = useMemo(() => {
    const buckets = new Map<
      string,
      { date: Date; score: number; total: number }
    >();

    for (const item of state.history) {
      if (!item.meetingDate) continue;
      const parsed = parseISO(item.meetingDate);
      if (!isValid(parsed)) continue;
      const monthStart = startOfMonth(parsed);
      const key = monthStart.toISOString();

      const bucket = buckets.get(key) ?? {
        date: monthStart,
        score: 0,
        total: 0,
      };

      bucket.total += 1;
      if (item.status === "present") {
        bucket.score += 1;
      } else if (item.status === "apology") {
        bucket.score += 0.5;
      }

      buckets.set(key, bucket);
    }

    return Array.from(buckets.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((bucket) => ({
        month: format(bucket.date, "MMM yyyy"),
        percentage:
          bucket.total === 0
            ? 0
            : Math.round((bucket.score / bucket.total) * 100),
      }));
  }, [state.history]);

  const stats: MemberAttendanceStats = useMemo(() => {
    const totalMeetings = state.member?.total_meetings ?? 0;
    const attended = state.member?.present_count ?? 0;
    const apologies = state.member?.apology_count ?? 0;
    const absences = state.member?.absent_count ?? 0;
    const attendancePercentage =
      totalMeetings === 0
        ? 0
        : Math.round((attended / totalMeetings) * 100);

    const trendDelta =
      trendData.length > 1
        ? trendData[trendData.length - 1].percentage -
          trendData[trendData.length - 2].percentage
        : null;

    return {
      totalMeetings,
      attended,
      apologies,
      absences,
      attendancePercentage,
      trendDelta,
    };
  }, [state.member, trendData]);

  return {
    member: state.member,
    history: state.history,
    loading: state.loading,
    error: state.error,
    stats,
    trendData,
    refresh: () => fetchAttendance(),
  };
}

