"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type {
  Attendance,
  CharityEvent,
  GuestMeetingCounts,
  MemberAttendanceSummary,
  Meeting,
  PipelinerEligibility,
} from "@/types/database";

export type ReportsAttendanceRecord = {
  meetingId: string;
  memberId: string;
  status: Attendance["status"];
  meetingDate: string | null;
  meetingType: string | null;
  meetingMonth: string | null;
  meetingYear: number | null;
  location: string | null;
};

type ReportsState = {
  members: MemberAttendanceSummary[];
  meetings: Meeting[];
  attendance: ReportsAttendanceRecord[];
  guests: GuestMeetingCounts[];
  pipeliners: PipelinerEligibility[];
  charityEvents: CharityEvent[];
  loading: boolean;
  error: string | null;
};

const initialState: ReportsState = {
  members: [],
  meetings: [],
  attendance: [],
  guests: [],
  pipeliners: [],
  charityEvents: [],
  loading: true,
  error: null,
};

export function useReportsData() {
  const [state, setState] = useState<ReportsState>(initialState);

  const setPartialState = useCallback((partial: Partial<ReportsState>) => {
    setState((previous) => ({ ...previous, ...partial }));
  }, []);

  const fetchReportsData = useCallback(
    async (options?: { silently?: boolean }) => {
      if (!options?.silently) {
        setPartialState({ loading: true, error: null });
      }

      try {
        const supabase = getSupabaseBrowserClient();

        const [
          { data: memberData, error: memberError },
          { data: meetingData, error: meetingsError },
          { data: attendanceData, error: attendanceError },
          { data: guestData, error: guestError },
          { data: pipelinerData, error: pipelinerError },
          { data: charityData, error: charityError },
        ] = await Promise.all([
          supabase
            .from("member_attendance_summary")
            .select("*")
            .order("full_name", { ascending: true }),
          supabase.from("meetings").select("*").order("meeting_date", { ascending: true }),
          supabase
            .from("attendance")
            .select(
              `
              meeting_id,
              member_id,
              status,
              meetings!attendance_meeting_id_fkey (
                meeting_date,
                meeting_type,
                meeting_month,
                meeting_year,
                location
              )
            `,
            )
            .not("member_id", "is", null),
          supabase
            .from("guest_meeting_counts")
            .select("*")
            .order("meeting_count", { ascending: false })
            .order("full_name", { ascending: true }),
          supabase
            .from("pipeliner_eligibility")
            .select("*")
            .order("full_name", { ascending: true }),
          supabase.from("charity_events").select("*").order("event_date", { ascending: false }),
        ]);

        if (memberError) throw memberError;
        if (meetingsError) throw meetingsError;
        if (attendanceError) throw attendanceError;
        if (guestError) throw guestError;
        if (pipelinerError) throw pipelinerError;
        if (charityError) throw charityError;

        const attendance: ReportsAttendanceRecord[] = (attendanceData ?? []).map((row) => {
          const meeting = row.meetings as
            | {
                meeting_date: string | null;
                meeting_type: string | null;
                meeting_month: string | null;
                meeting_year: number | null;
                location: string | null;
              }
            | null
            | undefined;

          return {
            meetingId: row.meeting_id,
            memberId: row.member_id as string,
            status: row.status as Attendance["status"],
            meetingDate: meeting?.meeting_date ?? null,
            meetingType: meeting?.meeting_type ?? null,
            meetingMonth: meeting?.meeting_month ?? null,
            meetingYear: meeting?.meeting_year ?? null,
            location: meeting?.location ?? null,
          };
        });

        setState({
          members: (memberData ?? []) as MemberAttendanceSummary[],
          meetings: (meetingData ?? []) as Meeting[],
          attendance,
          guests: (guestData ?? []) as GuestMeetingCounts[],
          pipeliners: (pipelinerData ?? []) as PipelinerEligibility[],
          charityEvents: (charityData ?? []) as CharityEvent[],
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error("Failed to load reports data", error);
        setPartialState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to load reports data right now.",
          loading: false,
        });
      } finally {
        if (!options?.silently) {
          setPartialState({ loading: false });
        }
      }
    },
    [setPartialState],
  );

  useEffect(() => {
    void fetchReportsData();
  }, [fetchReportsData]);

  const meetingLookup = useMemo(() => {
    const map = new Map<string, Meeting>();
    state.meetings.forEach((meeting) => {
      map.set(meeting.id, meeting);
    });
    return map;
  }, [state.meetings]);

  return {
    members: state.members,
    meetings: state.meetings,
    attendance: state.attendance,
    guests: state.guests,
    pipeliners: state.pipeliners,
    charityEvents: state.charityEvents,
    loading: state.loading,
    error: state.error,
    meetingLookup,
    refresh: () => fetchReportsData(),
  };
}


