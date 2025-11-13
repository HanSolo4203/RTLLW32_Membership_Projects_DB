"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  differenceInCalendarDays,
  format,
  parseISO,
  startOfYear,
} from "date-fns";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { MemberAttendanceSummary } from "@/types/database";

const ATTENDANCE_TARGET = 80;

export type MemberPerformance = {
  id: string;
  fullName: string;
  email: string;
  attendancePercentage: number;
  absentCount: number;
};

export type AlertTone = "danger" | "warning" | "success";

export type AlertAction = {
  label: string;
  href: string;
};

export type DashboardAlert = {
  id: string;
  tone: AlertTone;
  title: string;
  message: string;
  actions?: AlertAction[];
};

export type DashboardStats = {
  totals: {
    memberCount: number;
    newMembersThisYear: number;
  };
  attendance: {
    averagePercentage: number;
    deltaFromTarget: number;
    target: number;
  };
  pipeline: {
    activeCount: number;
    eligibleCount: number;
  };
  nextMeeting: {
    id: string;
    meetingDate: string;
    formattedDate: string;
    location: string | null;
    daysUntil: number;
  } | null;
  members: {
    topPerformers: MemberPerformance[];
    topPerformersCount: number;
    atRisk: MemberPerformance[];
    atRiskCount: number;
    criticalCount: number;
    warningCount: number;
  };
  alerts: DashboardAlert[];
};

type DashboardStatsResponse = DashboardStats;

export function useDashboardStats() {
  const query = useQuery<DashboardStatsResponse>({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const today = new Date();
      const todayIso = format(today, "yyyy-MM-dd");
      const yearStartIso = format(startOfYear(today), "yyyy-MM-dd");

      const [
        memberCountRes,
        newMembersRes,
        attendanceSummaryRes,
        activeGuestsRes,
        eligibleGuestsRes,
        activePipelinersRes,
        eligiblePipelinersRes,
        nextMeetingRes,
      ] = await Promise.all([
        supabase
          .from("members")
          .select("id", { count: "exact" })
          .eq("status", "active")
          .limit(1),
        supabase
          .from("members")
          .select("id", { count: "exact" })
          .eq("status", "active")
          .gte("join_date", yearStartIso)
          .limit(1),
        supabase.from("member_attendance_summary").select("*"),
        supabase
          .from("guests")
          .select("id", { count: "exact" })
          .eq("status", "active")
          .limit(1),
        supabase
          .from("guests")
          .select("id", { count: "exact" })
          .eq("status", "active")
          .gte("total_meetings", 3)
          .limit(1),
        supabase
          .from("pipeliners")
          .select("id", { count: "exact" })
          .eq("status", "active")
          .limit(1),
        supabase
          .from("pipeliners")
          .select("id", { count: "exact" })
          .eq("status", "active")
          .eq("is_eligible_for_membership", true)
          .limit(1),
        supabase
          .from("meetings")
          .select("id, meeting_date, location")
          .gte("meeting_date", todayIso)
          .order("meeting_date", { ascending: true })
          .limit(1),
      ]);

      const responsesWithErrors = [
        memberCountRes.error,
        newMembersRes.error,
        attendanceSummaryRes.error,
        activeGuestsRes.error,
        eligibleGuestsRes.error,
        activePipelinersRes.error,
        eligiblePipelinersRes.error,
        nextMeetingRes.error,
      ].filter(Boolean);

      if (responsesWithErrors.length > 0) {
        throw responsesWithErrors[0];
      }

      const memberCount = memberCountRes.count ?? 0;
      const newMembersThisYear = newMembersRes.count ?? 0;
      const activeGuests = activeGuestsRes.count ?? 0;
      const eligibleGuests = eligibleGuestsRes.count ?? 0;
      const activePipeliners = activePipelinersRes.count ?? 0;
      const eligiblePipeliners = eligiblePipelinersRes.count ?? 0;
      const pipelineActiveCount = activeGuests + activePipeliners;
      const eligibleForPromotion = eligibleGuests + eligiblePipeliners;

      const attendanceRows =
        (attendanceSummaryRes.data as MemberAttendanceSummary[]) ?? [];

      const activeMemberSummaries = attendanceRows
        .filter((row) => row.status === "active" && row.member_number !== null)
        .map<MemberPerformance>((row) => {
          const totalMeetings = row.total_meetings ?? 0;
          const presentCount = row.present_count ?? 0;
          const absentCount = row.absent_count ?? 0;
          const attendancePercentageRaw =
            totalMeetings > 0 ? (presentCount / totalMeetings) * 100 : 0;
          const attendancePercentage = Number(attendancePercentageRaw.toFixed(1));

          return {
            id: row.id,
            fullName: row.full_name,
            email: row.email,
            attendancePercentage,
            absentCount,
          };
        });

      const averageAttendanceRaw =
        activeMemberSummaries.length > 0
          ? activeMemberSummaries.reduce(
              (acc, member) => acc + member.attendancePercentage,
              0
            ) / activeMemberSummaries.length
          : 0;
      const averageAttendance = Number(averageAttendanceRaw.toFixed(1));

      const topPerformersFull = [...activeMemberSummaries]
        .filter((member) => member.attendancePercentage >= 90)
        .sort((a, b) => b.attendancePercentage - a.attendancePercentage);

      const atRiskFull = [...activeMemberSummaries]
        .filter((member) => member.attendancePercentage < 70)
        .sort((a, b) => a.attendancePercentage - b.attendancePercentage);

      const criticalCount = atRiskFull.filter(
        (member) => member.attendancePercentage < 60
      ).length;
      const warningCount = atRiskFull.length - criticalCount;

      const membersWithThreeAbsences = activeMemberSummaries
        .filter((member) => member.absentCount >= 3)
        .sort((a, b) => b.absentCount - a.absentCount);

      const nextMeetingRow = nextMeetingRes.data?.[0];
      const nextMeeting =
        nextMeetingRow != null
          ? (() => {
              const meetingDate = parseISO(nextMeetingRow.meeting_date);
              return {
                id: nextMeetingRow.id,
                meetingDate: nextMeetingRow.meeting_date,
                formattedDate: format(meetingDate, "EEE, d MMM yyyy"),
                location: nextMeetingRow.location,
                daysUntil: Math.max(
                  differenceInCalendarDays(meetingDate, today),
                  0
                ),
              };
            })()
          : null;

      const alerts: DashboardAlert[] = [];

      if (membersWithThreeAbsences.length > 0) {
        const highlightNames = membersWithThreeAbsences
          .slice(0, 3)
          .map((member) => member.fullName.split(" ")[0])
          .join(", ");
        const extraCount = membersWithThreeAbsences.length - 3;
        alerts.push({
          id: "attendance-follow-up",
          tone: "danger",
          title: "Members with 3+ absences",
          message: `${highlightNames}${
            extraCount > 0 ? ` +${extraCount} more` : ""
          } need check-ins before the next meeting.`,
          actions: [{ label: "Review Attendance", href: "/attendance" }],
        });
      }

      if (eligibleForPromotion > 0) {
        alerts.push({
          id: "promotion-eligible",
          tone: "warning",
          title: "Promotion opportunities",
          message: `${eligibleForPromotion} guests or pipeliners are ready for membership discussions.`,
          actions: [
            { label: "View Pipeline", href: "/pipeliners" },
            { label: "Review Guests", href: "/guests" },
          ],
        });
      }

      if (newMembersThisYear > 0) {
        alerts.push({
          id: "celebrate-members",
          tone: "success",
          title: "Celebrate new members",
          message: `${newMembersThisYear} new members joined this year. Make sure they feel welcomed.`,
          actions: [{ label: "Manage Members", href: "/members" }],
        });
      }

      return {
        totals: {
          memberCount,
          newMembersThisYear,
        },
        attendance: {
          averagePercentage: averageAttendance,
          deltaFromTarget: Number((averageAttendance - ATTENDANCE_TARGET).toFixed(1)),
          target: ATTENDANCE_TARGET,
        },
        pipeline: {
          activeCount: pipelineActiveCount,
          eligibleCount: eligibleForPromotion,
        },
        nextMeeting,
        members: {
          topPerformers: topPerformersFull.slice(0, 5),
          topPerformersCount: topPerformersFull.length,
          atRisk: atRiskFull.slice(0, 5),
          atRiskCount: atRiskFull.length,
          criticalCount,
          warningCount,
        },
        alerts,
      };
    },
    staleTime: 30 * 1000,
  });

  const { data, isLoading, isFetching, error, refetch } = query;

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel("dashboard-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, () =>
        refetch()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "members" }, () =>
        refetch()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "guests" }, () =>
        refetch()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeliners" }, () =>
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


