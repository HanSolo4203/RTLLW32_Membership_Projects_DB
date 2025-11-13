import {
  endOfMonth,
  format,
  isBefore,
  parseISO,
  startOfMonth,
  startOfYear,
} from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type MembershipStats = {
  month: string;
  monthName: string;
  year: number;
  activeMembers: number;
  attendedLastMeeting: number;
  attendanceRate: number;
  yearlyAverage: number;
  pipelinerPresentCount: number;
  pipelinerAttendanceRate: number;
  pipeliners: number;
  meetingAttendanceCount: number;
  meetingAttendancePercentage: number;
};

function normalizeMonthInput(month: string) {
  const normalized = month.length === 7 ? `${month}-01` : month;
  const parsed = parseISO(normalized);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid month provided.");
  }

  return parsed;
}

function roundToTwoDecimals(value: number) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

export async function fetchMembershipStats(
  supabase: SupabaseClient<Database, any, any, any>,
  month: string,
): Promise<MembershipStats> {
  const targetMonth = normalizeMonthInput(month);
  const monthStart = startOfMonth(targetMonth);
  const monthEnd = endOfMonth(targetMonth);
  const yearStart = startOfYear(targetMonth);

  const monthStartString = format(monthStart, "yyyy-MM-dd");
  const monthEndString = format(monthEnd, "yyyy-MM-dd");
  const yearStartString = format(yearStart, "yyyy-MM-dd");
  const requestedMonthEnd = format(monthEnd, "yyyy-MM-dd");
  const todayString = format(new Date(), "yyyy-MM-dd");
  const yearRangeEnd = requestedMonthEnd < todayString ? requestedMonthEnd : todayString;

  const [
    { data: activeMembersData, error: activeMembersError },
    { count: pipelinersCount, error: pipelinersError },
  ] = await Promise.all([
    supabase
      .from("members")
      .select("id")
      .eq("status", "active")
      .not("member_number", "is", null),
    supabase
      .from("pipeliners")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  if (activeMembersError) {
    throw activeMembersError;
  }

  if (pipelinersError) {
    throw pipelinersError;
  }

  const activeMemberIds = (activeMembersData ?? []).map((row) => row.id);
  const activeMembers = activeMemberIds.length;
  const activeMemberSet = new Set(activeMemberIds);

  const [
    { data: monthMeetings, error: monthMeetingsError },
    { data: yearMeetings, error: yearMeetingsError },
  ] = await Promise.all([
    supabase
      .from("meetings")
      .select("id, meeting_date, meeting_type")
      .gte("meeting_date", monthStartString)
      .lte("meeting_date", monthEndString),
    supabase
      .from("meetings")
      .select("id, meeting_date")
      .gte("meeting_date", yearStartString)
      .lte("meeting_date", yearRangeEnd),
  ]);

  if (monthMeetingsError) {
    throw monthMeetingsError;
  }

  if (yearMeetingsError) {
    throw yearMeetingsError;
  }

  const monthMeetingRecords = monthMeetings ?? [];
  const filteredYearMeetings = (yearMeetings ?? []).filter((meeting) =>
    isBefore(parseISO(meeting.meeting_date), new Date(todayString)) ||
    meeting.meeting_date === todayString,
  );
  const yearMeetingIds = filteredYearMeetings.map((meeting) => meeting.id);

  const monthMeetingIds = monthMeetingRecords.map((meeting) => meeting.id);

  let meetingAttendanceCount = 0;
  let meetingAttendancePercentage = 0;
  let attendedLastMeeting = 0;
  let pipelinerPresentTotal = 0;
  let pipelinerAttendanceRate = 0;

  if (monthMeetingIds.length > 0) {
    const { data: monthAttendance, error: monthAttendanceError } = await supabase
      .from("attendance")
      .select("meeting_id, member_id, pipeliner_id")
      .in("meeting_id", monthMeetingIds)
      .eq("status", "present");

    if (monthAttendanceError) {
      throw monthAttendanceError;
    }

    const uniqueMonthlyAttendees = new Set<string>();
    const attendanceByMeeting = new Map<string, Set<string>>();
    const pipelinerMonthlyAttendance = new Map<string, number>();

    (monthAttendance ?? []).forEach((entry) => {
      if (entry.member_id) {
        uniqueMonthlyAttendees.add(entry.member_id);

        const existing = attendanceByMeeting.get(entry.meeting_id);
        if (existing) {
          existing.add(entry.member_id);
        } else {
          attendanceByMeeting.set(entry.meeting_id, new Set([entry.member_id]));
        }
      }

      if (entry.pipeliner_id) {
        pipelinerMonthlyAttendance.set(
          entry.pipeliner_id,
          (pipelinerMonthlyAttendance.get(entry.pipeliner_id) ?? 0) + 1,
        );
      }
    });

    meetingAttendanceCount = uniqueMonthlyAttendees.size;
    meetingAttendancePercentage =
      activeMembers > 0
        ? (uniqueMonthlyAttendees.size / activeMembers) * 100
        : 0;

    pipelinerPresentTotal = Array.from(pipelinerMonthlyAttendance.values()).reduce(
      (sum, value) => sum + value,
      0,
    );
    pipelinerAttendanceRate =
      pipelinersCount && pipelinersCount > 0
        ? (pipelinerPresentTotal / (pipelinersCount * monthMeetingIds.length)) * 100
        : 0;

    if (monthMeetingRecords.length > 0) {
      const sortedMeetings = [...monthMeetingRecords].sort((a, b) =>
        a.meeting_date.localeCompare(b.meeting_date),
      );
      const businessMeetings = sortedMeetings.filter(
        (meeting) => meeting.meeting_type === "business",
      );
      const lastMeeting =
        businessMeetings[businessMeetings.length - 1] ??
        sortedMeetings[sortedMeetings.length - 1];

      if (lastMeeting) {
        attendedLastMeeting =
          attendanceByMeeting.get(lastMeeting.id)?.size ?? 0;
      }
    }
  }

  let yearlyAverageAttendance = 0;

  if (yearMeetingIds.length > 0) {
    const { data: yearAttendance, error: yearAttendanceError } = await supabase
      .from("attendance")
      .select("member_id, status")
      .in("meeting_id", yearMeetingIds)
      .not("member_id", "is", null);

    if (yearAttendanceError) {
      throw yearAttendanceError;
    }

    const memberAttendanceMap = new Map<string, { present: number; total: number }>();

    (yearAttendance ?? []).forEach((entry) => {
      const memberId = entry.member_id as string | null;
      if (!memberId || !activeMemberSet.has(memberId)) {
        return;
      }

      const stats = memberAttendanceMap.get(memberId) ?? { present: 0, total: 0 };
      stats.total += 1;
      if (entry.status === "present") {
        stats.present += 1;
      }
      memberAttendanceMap.set(memberId, stats);
    });

    const memberAverages: number[] = [];
    memberAttendanceMap.forEach((value) => {
      if (value.total > 0) {
        memberAverages.push((value.present / value.total) * 100);
      }
    });

    yearlyAverageAttendance =
      memberAverages.length > 0
        ? memberAverages.reduce((sum, value) => sum + value, 0) / memberAverages.length
        : 0;
  }

  return {
    month: format(targetMonth, "yyyy-MM"),
    monthName: format(targetMonth, "MMMM"),
    year: Number.parseInt(format(targetMonth, "yyyy"), 10),
    activeMembers,
    attendedLastMeeting,
    attendanceRate: roundToTwoDecimals(meetingAttendancePercentage),
    yearlyAverage: roundToTwoDecimals(yearlyAverageAttendance),
    pipelinerPresentCount: pipelinerPresentTotal,
    pipelinerAttendanceRate: roundToTwoDecimals(pipelinerAttendanceRate),
    pipeliners: pipelinersCount ?? 0,
    meetingAttendanceCount,
    meetingAttendancePercentage: roundToTwoDecimals(meetingAttendancePercentage),
  };
}


