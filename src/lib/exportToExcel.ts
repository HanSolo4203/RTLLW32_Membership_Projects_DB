"use client";

import type { WorkBook, WorkSheet } from "xlsx";
import * as XLSX from "xlsx";

import type {
  GuestMeetingCounts,
  MemberAttendanceSummary,
  Meeting,
  PipelinerEligibility,
} from "@/types/database";
import type { ReportsAttendanceRecord } from "@/hooks/useReportsData";

type ExcelExportOptions = {
  members: MemberAttendanceSummary[];
  meetings: Meeting[];
  attendance: ReportsAttendanceRecord[];
  guests: GuestMeetingCounts[];
  pipeliners: PipelinerEligibility[];
};

const STATUS_SYMBOL_MAP: Record<string, string> = {
  present: "✓",
  apology: "A",
  absent: "X",
};

function formatDate(date: string | null | undefined) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(Number(parsed))) return "";
  return parsed.toISOString().split("T")[0];
}

function buildAttendanceMatrixSheet(
  members: MemberAttendanceSummary[],
  meetings: Meeting[],
  attendance: ReportsAttendanceRecord[],
): WorkSheet {
  const meetingLookup = new Map<string, Meeting>();
  meetings.forEach((meeting) => meetingLookup.set(meeting.id, meeting));

  const attendanceByMember = new Map<string, Map<string, ReportsAttendanceRecord>>();
  attendance.forEach((record) => {
    const memberMap =
      attendanceByMember.get(record.memberId) ??
      new Map<string, ReportsAttendanceRecord>();
    memberMap.set(record.meetingId, record);
    attendanceByMember.set(record.memberId, memberMap);
  });

  const header: (string | number)[] = [
    "Member",
    ...meetings.map(
      (meeting) => `${formatDate(meeting.meeting_date)} (${meeting.meeting_type ?? "business"})`,
    ),
    "Attendance %",
    "Total Meetings",
  ];
  const data: (string | number)[][] = [header];

  members.forEach((member) => {
    const records = attendanceByMember.get(member.id);
    const totalMeetings = member.total_meetings ?? 0;
    const present = member.present_count ?? 0;
    const attendancePercentage =
      totalMeetings === 0 ? 0 : Math.round((present / totalMeetings) * 100);

    const row: (string | number)[] = [member.full_name];
    meetings.forEach((meeting) => {
      const record = records?.get(meeting.id);
      const symbol = record ? STATUS_SYMBOL_MAP[record.status] ?? "X" : "X";
      row.push(symbol);
    });
    row.push(attendancePercentage);
    row.push(totalMeetings);
    data.push(row);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Apply simple cell styles
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1");
  for (let r = 1; r <= range.e.r; r += 1) {
    const percentageCell = XLSX.utils.encode_cell({ r, c: range.e.c - 1 });
    const value = worksheet[percentageCell]?.v as number | undefined;
    if (typeof value === "number") {
      let fill = "FFEF4444";
      if (value >= 80) fill = "FF16A34A";
      else if (value >= 60) fill = "FF2563EB";
      else if (value >= 40) fill = "FFF59E0B";

      worksheet[percentageCell] = {
        ...worksheet[percentageCell],
        t: "n",
        s: {
          font: { color: { rgb: "FFFFFFFF" }, bold: true },
          fill: { fgColor: { rgb: fill } },
          alignment: { horizontal: "center" },
          numFmt: "0%",
        },
        v: value / 100,
      };
    }

    const meetingsCell = XLSX.utils.encode_cell({ r, c: range.e.c });
    worksheet[meetingsCell] = {
      ...worksheet[meetingsCell],
      t: "n",
    };
  }

  // Totals row
  const totalRowIndex = range.e.r + 1;
  const totalsLabelCell = XLSX.utils.encode_cell({ r: totalRowIndex, c: 0 });
  worksheet[totalsLabelCell] = { t: "s", v: "Totals" };

  meetings.forEach((_, index) => {
    const column = XLSX.utils.encode_col(index + 1);
    const cellAddress = `${column}${totalRowIndex + 1}`;
    const firstRow = 2;
    const lastRow = range.e.r + 1;
    worksheet[cellAddress] = {
      t: "n",
      f: `COUNTIF(${column}${firstRow}:${column}${lastRow},"✓")`,
    };
  });

  const attendanceColumn = XLSX.utils.encode_col(range.e.c - 1);
  const attendanceAverageCell = `${attendanceColumn}${totalRowIndex + 1}`;
  worksheet[attendanceAverageCell] = {
    t: "n",
    f: `AVERAGE(${attendanceColumn}2:${attendanceColumn}${range.e.r + 1})`,
  };
  worksheet[attendanceAverageCell].s = {
    font: { bold: true },
    numFmt: "0.00",
  };

  worksheet["!cols"] = header.map(() => ({ wch: 18 }));

  return worksheet;
}

function buildMemberDetailsSheet(members: MemberAttendanceSummary[]): WorkSheet {
  const data = [
    [
      "Member",
      "Email",
      "Phone",
      "Join Date",
      "Status",
      "Meetings",
      "Present",
      "Apologies",
      "Absent",
      "Attendance %",
    ],
    ...members.map((member) => {
      const totalMeetings = member.total_meetings ?? 0;
      const present = member.present_count ?? 0;
      const attendancePercentage =
        totalMeetings === 0 ? 0 : Math.round((present / totalMeetings) * 100);
      return [
        member.full_name,
        member.email ?? "",
        member.phone ?? "",
        formatDate(member.join_date),
        member.status ?? "",
        totalMeetings,
        member.present_count ?? 0,
        member.apology_count ?? 0,
        member.absent_count ?? 0,
        attendancePercentage / 100,
      ];
    }),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const attendanceColumn = XLSX.utils.encode_col(data[0].length - 1);
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1");

  for (let r = 1; r <= range.e.r; r += 1) {
    const cellAddress = `${attendanceColumn}${r + 1}`;
    worksheet[cellAddress] = {
      ...worksheet[cellAddress],
      t: "n",
      numFmt: "0%",
    };
  }

  worksheet["!cols"] = data[0].map(() => ({ wch: 18 }));
  return worksheet;
}

function buildMeetingsSheet(
  meetings: Meeting[],
  attendance: ReportsAttendanceRecord[],
): WorkSheet {
  const attendanceByMeeting = new Map<string, ReportsAttendanceRecord[]>();
  attendance.forEach((record) => {
    const list = attendanceByMeeting.get(record.meetingId) ?? [];
    list.push(record);
    attendanceByMeeting.set(record.meetingId, list);
  });

  const data = [
    ["Date", "Type", "Location", "Total Recorded", "Present", "Apologies", "Absent", "Attendance %"],
    ...meetings.map((meeting) => {
      const records = attendanceByMeeting.get(meeting.id) ?? [];
      const present = records.filter((record) => record.status === "present").length;
      const apologies = records.filter((record) => record.status === "apology").length;
      const absent = records.filter((record) => record.status === "absent").length;
      const total = records.length;
      const percentage = total === 0 ? 0 : ((present + 0.5 * apologies) / total) * 100;

      return [
        formatDate(meeting.meeting_date),
        meeting.meeting_type ?? "business",
        meeting.location ?? "",
        total,
        present,
        apologies,
        absent,
        percentage / 100,
      ];
    }),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const percentageColumn = XLSX.utils.encode_col(data[0].length - 1);
  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1");
  for (let r = 1; r <= range.e.r; r += 1) {
    const cellAddress = `${percentageColumn}${r + 1}`;
    worksheet[cellAddress] = {
      ...worksheet[cellAddress],
      t: "n",
      numFmt: "0.00%",
    };
  }

  worksheet["!cols"] = data[0].map(() => ({ wch: 18 }));
  return worksheet;
}

function buildGuestPipelinerSheet(
  guests: GuestMeetingCounts[],
  pipeliners: PipelinerEligibility[],
): WorkSheet {
  const header = [
    "Name",
    "Email",
    "Phone",
    "Invited/Sponsored By",
    "Meetings",
    "Charity Events",
    "Status",
    "Eligible",
    "Category",
  ];

  const guestRows = guests.map((guest) => [
    guest.full_name,
    guest.email ?? "",
    guest.phone ?? "",
    guest.invited_by ?? "",
    guest.meeting_count ?? 0,
    "",
    guest.status ?? "",
    guest.eligible_for_pipeliner ? "Yes" : "No",
    "Guest",
  ]);

  const pipelinerRows = pipeliners.map((pipeliner) => [
    pipeliner.full_name,
    pipeliner.email ?? "",
    pipeliner.phone ?? "",
    pipeliner.sponsored_by ?? "",
    pipeliner.meeting_count ?? 0,
    pipeliner.charity_event_count ?? 0,
    pipeliner.status ?? "",
    pipeliner.meets_requirements ? "Yes" : "No",
    "Pipeliner",
  ]);

  const data = [header, ...guestRows, ...pipelinerRows];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  worksheet["!cols"] = header.map(() => ({ wch: 20 }));
  return worksheet;
}

export async function exportAttendanceWorkbookToExcel({
  members,
  meetings,
  attendance,
  guests,
  pipeliners,
}: ExcelExportOptions) {
  const workbook: WorkBook = XLSX.utils.book_new();

  const attendanceSheet = buildAttendanceMatrixSheet(members, meetings, attendance);
  const memberSheet = buildMemberDetailsSheet(members);
  const meetingSheet = buildMeetingsSheet(meetings, attendance);
  const guestSheet = buildGuestPipelinerSheet(guests, pipeliners);

  XLSX.utils.book_append_sheet(workbook, attendanceSheet, "Attendance Matrix");
  XLSX.utils.book_append_sheet(workbook, memberSheet, "Member Details");
  XLSX.utils.book_append_sheet(workbook, meetingSheet, "Meeting Summary");
  XLSX.utils.book_append_sheet(workbook, guestSheet, "Guests & Pipeliners");

  const today = new Date().toISOString().split("T")[0];
  const filename = `RTL32_Attendance_Report_${today}.xlsx`;

  XLSX.writeFile(workbook, filename);
}


