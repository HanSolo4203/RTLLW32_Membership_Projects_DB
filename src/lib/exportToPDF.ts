"use client";

import { format } from "date-fns";

import type {
  CharityEvent,
  GuestMeetingCounts,
  MemberAttendanceSummary,
  Meeting,
  PipelinerEligibility,
} from "@/types/database";
import type { ReportsAttendanceRecord } from "@/hooks/useReportsData";

type PdfExportOptions = {
  members: MemberAttendanceSummary[];
  meetings: Meeting[];
  attendance: ReportsAttendanceRecord[];
  guests: GuestMeetingCounts[];
  pipeliners: PipelinerEligibility[];
  charityEvents: CharityEvent[];
  logoDataUrl?: string;
  year?: number;
};

function calculateAttendanceStats(members: MemberAttendanceSummary[]) {
  const totalMembers = members.length;
  const withMeetings = members.filter((member) => (member.total_meetings ?? 0) > 0);
  const averageAttendance =
    withMeetings.length === 0
      ? 0
      : Math.round(
          withMeetings.reduce((acc, member) => {
            const total = member.total_meetings ?? 0;
            const present = member.present_count ?? 0;
            return acc + (total === 0 ? 0 : (present / total) * 100);
          }, 0) / withMeetings.length,
        );

  const topPerformers = [...withMeetings]
    .sort((a, b) => {
      const aPct =
        (a.present_count ?? 0) / Math.max(a.total_meetings ?? 0, 1);
      const bPct =
        (b.present_count ?? 0) / Math.max(b.total_meetings ?? 0, 1);
      return bPct - aPct;
    })
    .slice(0, 5);

  const atRiskMembers = withMeetings.filter((member) => {
    const total = member.total_meetings ?? 0;
    const present = member.present_count ?? 0;
    const percentage = total === 0 ? 0 : (present / total) * 100;
    return percentage < 60;
  }).length;

  return {
    totalMembers,
    averageAttendance,
    topPerformers,
    atRiskMembers,
  };
}

function summarizeProgression(
  guests: GuestMeetingCounts[],
  pipeliners: PipelinerEligibility[],
  members: MemberAttendanceSummary[],
) {
  const totalGuests = guests.length;
  const eligibleGuests = guests.filter((guest) => guest.eligible_for_pipeliner).length;
  const totalPipeliners = pipeliners.length;
  const eligiblePipeliners = pipeliners.filter((p) => p.meets_requirements).length;
  const activeMembers = members.filter((member) => member.status === "active").length;

  return {
    totalGuests,
    eligibleGuests,
    totalPipeliners,
    eligiblePipeliners,
    activeMembers,
  };
}

function summarizeCharityEvents(events: CharityEvent[]) {
  const totalEvents = events.length;
  const lastEvent = events.at(0);
  const uniqueParticipants = new Set<string>();
  events.forEach((event) => {
    (event.participant_ids ?? []).forEach((id) => uniqueParticipants.add(id));
  });

  return {
    totalEvents,
    uniqueParticipants: uniqueParticipants.size,
    lastEvent,
  };
}

function buildRecommendations({
  averageAttendance,
  atRiskMembers,
  totalEvents,
}: {
  averageAttendance: number;
  atRiskMembers: number;
  totalEvents: number;
}) {
  const recommendations: string[] = [];

  if (averageAttendance < 80) {
    recommendations.push(
      "Prioritise mentorship and accountability programmes to lift average attendance above 80%.",
    );
  } else {
    recommendations.push(
      "Maintain momentum by recognising consistent attendance and sharing success stories.",
    );
  }

  if (atRiskMembers > 0) {
    recommendations.push(
      `Activate follow-up teams for the ${atRiskMembers} member(s) below 60% attendance to understand challenges and provide support.`,
    );
  } else {
    recommendations.push("All members are performing well—celebrate this achievement widely.");
  }

  if (totalEvents < 4) {
    recommendations.push(
      "Scale charity programming to at least one event per quarter to strengthen community visibility.",
    );
  } else {
    recommendations.push(
      "Leverage charity successes to attract new guests and convert them into engaged pipeliners.",
    );
  }

  return recommendations;
}

export async function exportYearEndReportToPDF({
  members,
  meetings,
  attendance,
  guests,
  pipeliners,
  charityEvents,
  logoDataUrl,
  year = new Date().getFullYear(),
}: PdfExportOptions) {
  const { default: jsPDF } = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  const stats = calculateAttendanceStats(members);
  const progression = summarizeProgression(guests, pipeliners, members);
  const charitySummary = summarizeCharityEvents(charityEvents);
  const recommendations = buildRecommendations({
    averageAttendance: stats.averageAttendance,
    atRiskMembers: stats.atRiskMembers,
    totalEvents: charitySummary.totalEvents,
  });

  // Cover Page
  doc.setFillColor("#0f172a");
  doc.rect(0, 0, pageWidth, 160, "F");
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", margin, 30, 120, 120);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.setTextColor("#ffffff");
  doc.text("Right Stay Africa Round Table", margin + 140, 80);
  doc.setFontSize(22);
  doc.text(`Year-End Attendance Report ${year}`, margin + 140, 120);

  doc.setFontSize(14);
  doc.text(`Generated on ${format(new Date(), "dd MMM yyyy HH:mm")}`, margin, 220);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#1e293b");
  doc.setFontSize(12);
  doc.text(
    [
      "This report provides a comprehensive review of attendance, engagement, and charity activity across the Round Table leadership community.",
      "Use these insights to celebrate wins, address gaps, and set a confident plan for the year ahead.",
    ],
    margin,
    260,
    { maxWidth: pageWidth - margin * 2 },
  );

  doc.addPage();

  // Executive Summary
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor("#0f172a");
  doc.text("Executive Summary", margin, 60);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.text(
    [
      `Total Members: ${stats.totalMembers}`,
      `Average Attendance: ${stats.averageAttendance}%`,
      `Members At Risk: ${stats.atRiskMembers}`,
      `Charity Events Hosted: ${charitySummary.totalEvents}`,
    ],
    margin,
    100,
    { lineHeightFactor: 1.6 },
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Key Highlights", margin, 210);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(
    [
      "• Membership continues to grow with a strong pipeline of prospective leaders.",
      "• Charity programme impact is increasing, attracting new participants and partners.",
      "• Attendance remains resilient, with clear opportunities to support members needing assistance.",
    ],
    margin,
    240,
    { lineHeightFactor: 1.8 },
  );

  doc.addPage();

  // Attendance Summary Table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Attendance Summary", margin, 50);

  const attendanceByMeeting = new Map<string, ReportsAttendanceRecord[]>();
  attendance.forEach((record) => {
    const list = attendanceByMeeting.get(record.meetingId) ?? [];
    list.push(record);
    attendanceByMeeting.set(record.meetingId, list);
  });

  const attendanceBody = meetings.map((meeting) => {
    const records = attendanceByMeeting.get(meeting.id) ?? [];
    const present = records.filter((record) => record.status === "present").length;
    const apology = records.filter((record) => record.status === "apology").length;
    const absent = records.filter((record) => record.status === "absent").length;
    const total = records.length;
    const percentage = total === 0 ? 0 : Math.round(((present + 0.5 * apology) / total) * 100);
    return [
      format(new Date(meeting.meeting_date), "dd MMM yyyy"),
      meeting.meeting_type ?? "business",
      meeting.location ?? "—",
      total,
      present,
      apology,
      absent,
      `${percentage}%`,
    ];
  });

  autoTableModule.default(doc, {
    startY: 80,
    head: [["Date", "Type", "Location", "Total", "Present", "Apologies", "Absent", "Attendance %"]],
    body: attendanceBody,
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
  });

  doc.addPage();

  // Top performers
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Top Performers", margin, 60);

  const topBody = stats.topPerformers.map((member) => {
    const total = member.total_meetings ?? 0;
    const present = member.present_count ?? 0;
    const percentage = total === 0 ? 0 : Math.round((present / total) * 100);
    return [
      member.full_name,
      member.email ?? "—",
      total,
      `${percentage}%`,
    ];
  });

  autoTableModule.default(doc, {
    startY: 90,
    head: [["Member", "Email", "Meetings", "Attendance %"]],
    body: topBody,
    styles: { fontSize: 11, cellPadding: 6 },
    headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255] },
  });

  // Member progression
  const progressionY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    ? (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable!.finalY + 40
    : 260;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Member Progression", margin, progressionY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(
    [
      `Guests in pipeline: ${progression.totalGuests} (${progression.eligibleGuests} promotion-ready)`,
      `Active pipeliners: ${progression.totalPipeliners} (${progression.eligiblePipeliners} ready for membership)`,
      `Active members: ${progression.activeMembers}`,
    ],
    margin,
    progressionY + 30,
    { lineHeightFactor: 1.6 },
  );

  doc.addPage();

  // Charity summary
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Charity Programme Highlights", margin, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  const charityText: string[] = [
    `Total charity events hosted: ${charitySummary.totalEvents}`,
    `Unique participants engaged: ${charitySummary.uniqueParticipants}`,
  ];
  if (charitySummary.lastEvent) {
    charityText.push(
      `Most recent event: ${charitySummary.lastEvent.event_name} on ${format(
        new Date(charitySummary.lastEvent.event_date),
        "dd MMM yyyy",
      )}`,
    );
  }
  doc.text(charityText, margin, 100, { lineHeightFactor: 1.6 });

  autoTableModule.default(doc, {
    startY: 160,
    head: [["Event", "Date", "Description", "Participants"]],
    body: charityEvents.map((event) => [
      event.event_name,
      format(new Date(event.event_date), "dd MMM yyyy"),
      event.description ?? "—",
      (event.participant_ids ?? []).length,
    ]),
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [6, 182, 212], textColor: [255, 255, 255] },
  });

  doc.addPage();

  // Recommendations
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Recommendations", margin, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(
    recommendations.map((item) => `• ${item}`),
    margin,
    100,
    { lineHeightFactor: 1.8 },
  );

  doc.save(`RTL32_Year_End_Report_${year}.pdf`);
}


