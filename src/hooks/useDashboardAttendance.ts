"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, subMonths, subYears } from "date-fns";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type AttendanceRange = "6m" | "1y" | "all";

export type AttendancePoint = {
  meetingId: string;
  meetingDate: string;
  formattedDate: string;
  label: string;
  presentCount: number;
  totalMembers: number;
  attendancePercentage: number;
  targetPercentage: number;
};

type AttendanceResponse = {
  points: AttendancePoint[];
  activeMemberCount: number;
};

const ATTENDANCE_TARGET = 80;

function getRangeStart(range: AttendanceRange, today: Date) {
  switch (range) {
    case "6m":
      return subMonths(today, 6);
    case "1y":
      return subYears(today, 1);
    default:
      return null;
  }
}

export function useDashboardAttendance(range: AttendanceRange) {
  const query = useQuery<AttendanceResponse>({
    queryKey: ["dashboard", "attendance", range],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const today = new Date();
      const todayIso = format(today, "yyyy-MM-dd");
      const startDate = getRangeStart(range, today);
      const startDateIso = startDate ? format(startDate, "yyyy-MM-dd") : null;

      const memberCountPromise = supabase
        .from("members")
        .select("id", { count: "exact" })
        .eq("status", "active")
        .limit(1);

      let meetingsQuery = supabase
        .from("meetings")
        .select(
          "id, meeting_date, meeting_month, location, attendance:attendance(status, member_id)"
        )
        .lte("meeting_date", todayIso)
        .order("meeting_date", { ascending: true });

      if (startDateIso) {
        meetingsQuery = meetingsQuery.gte("meeting_date", startDateIso);
      }

      const [memberCountRes, meetingsRes] = await Promise.all([
        memberCountPromise,
        meetingsQuery,
      ]);

      if (memberCountRes.error) {
        throw memberCountRes.error;
      }

      if (meetingsRes.error) {
        throw meetingsRes.error;
      }

      const activeMemberCount = memberCountRes.count ?? 0;
      const meetings = meetingsRes.data ?? [];

      const points: AttendancePoint[] = meetings.map((meeting) => {
        const meetingDate = parseISO(meeting.meeting_date);
        const presentCount =
          meeting.attendance?.filter(
            (attendance) =>
              attendance.status === "present" && attendance.member_id !== null
          ).length ?? 0;

        const labelFormat =
          range === "all" ? "MMM yyyy" : range === "1y" ? "MMM yyyy" : "d MMM";

        return {
          meetingId: meeting.id,
          meetingDate: meeting.meeting_date,
          formattedDate: format(meetingDate, "EEE, d MMM yyyy"),
          label: format(meetingDate, labelFormat),
          presentCount,
          totalMembers: activeMemberCount,
          attendancePercentage:
            activeMemberCount > 0
              ? Number(((presentCount / activeMemberCount) * 100).toFixed(1))
              : 0,
          targetPercentage: ATTENDANCE_TARGET,
        };
      });

      return {
        points,
        activeMemberCount,
      };
    },
    staleTime: 30 * 1000,
  });

  const { data, isLoading, isFetching, error, refetch } = query;

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel("dashboard-attendance")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, () =>
        refetch()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () =>
        refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const memoizedData = useMemo(() => data, [data]);

  return {
    data: memoizedData,
    isLoading,
    isFetching,
    error,
    refetch,
  };
}


