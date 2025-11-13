"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ReportsAttendanceRecord } from "@/hooks/useReportsData";
import type { MemberAttendanceSummary, Meeting } from "@/types/database";

type TrendChartProps = {
  meetings: Meeting[];
  attendance: ReportsAttendanceRecord[];
  members: MemberAttendanceSummary[];
  selectedMemberIds: string[];
};

const MEETING_TYPE_COLORS: Record<string, string> = {
  business: "#2563eb",
  charity: "#16a34a",
  special: "#e11d48",
};

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function parseDate(value: string | null | undefined) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(Number(parsed)) ? parsed : null;
}

export function TrendChart({
  meetings,
  attendance,
  members,
  selectedMemberIds,
}: TrendChartProps) {
  const lineData = useMemo(() => {
    const monthMap = new Map<string, { label: string; score: number; total: number }>();

    attendance.forEach((record) => {
      const meeting = meetings.find((entry) => entry.id === record.meetingId);
      const meetingDate = parseDate(record.meetingDate ?? meeting?.meeting_date);
      if (!meetingDate) return;

      const key = `${meetingDate.getUTCFullYear()}-${meetingDate.getUTCMonth()}`;
      const label = meetingDate.toLocaleDateString(undefined, { month: "short", year: "numeric" });
      const bucket = monthMap.get(key) ?? { label, score: 0, total: 0 };

      bucket.total += 1;
      if (record.status === "present") {
        bucket.score += 1;
      } else if (record.status === "apology") {
        bucket.score += 0.5;
      }
      monthMap.set(key, bucket);
    });

    const overall = [...monthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, bucket]) => ({
        monthKey: key,
        month: bucket.label,
        overall: bucket.total === 0 ? 0 : Math.round((bucket.score / bucket.total) * 100),
      }));

    const memberTrends = new Map<string, { monthKey: string; month: string; value: number }[]>();
    selectedMemberIds.forEach((memberId) => {
      const memberRecords = attendance.filter((record) => record.memberId === memberId);
      const monthly = new Map<string, { label: string; score: number; total: number }>();

      memberRecords.forEach((record) => {
        const meeting = meetings.find((entry) => entry.id === record.meetingId);
        const meetingDate = parseDate(record.meetingDate ?? meeting?.meeting_date);
        if (!meetingDate) return;
        const key = `${meetingDate.getUTCFullYear()}-${meetingDate.getUTCMonth()}`;
        const label = meetingDate.toLocaleDateString(undefined, {
          month: "short",
          year: "numeric",
        });
        const bucket = monthly.get(key) ?? { label, score: 0, total: 0 };

        bucket.total += 1;
        if (record.status === "present") bucket.score += 1;
        else if (record.status === "apology") bucket.score += 0.5;
        monthly.set(key, bucket);
      });

      const trend = [...monthly.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([monthKey, bucket]) => ({
          monthKey,
          month: bucket.label,
          value: bucket.total === 0 ? 0 : Math.round((bucket.score / bucket.total) * 100),
        }));
      memberTrends.set(memberId, trend);
    });

    const lineChart = overall.map((entry) => {
      const dataPoint: Record<string, number | string> = {
        month: entry.month,
        overall: entry.overall,
      };

      memberTrends.forEach((trend, memberId) => {
        const match = trend.find((item) => item.monthKey === entry.monthKey);
        dataPoint[memberId] = match ? match.value : 0;
      });

      return dataPoint;
    });

    return lineChart;
  }, [attendance, meetings, selectedMemberIds]);

  const meetingTypeData = useMemo(() => {
    const stats = meetings.reduce<Record<string, number>>((acc, meeting) => {
      const type = meeting.meeting_type ?? "business";
      acc[type] = (acc[type] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(stats).map(([type, value]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      value,
      color: MEETING_TYPE_COLORS[type] ?? "#2563eb",
    }));
  }, [meetings]);

  const dayPatternData = useMemo(() => {
    const map = new Map<
      string,
      { label: string; score: number; total: number; present: number; apology: number }
    >();

    attendance.forEach((record) => {
      const meeting = meetings.find((entry) => entry.id === record.meetingId);
      const meetingDate = parseDate(record.meetingDate ?? meeting?.meeting_date);
      if (!meetingDate) return;
      const day = meetingDate.toLocaleDateString(undefined, { weekday: "long" });
      const bucket = map.get(day) ?? { label: day, score: 0, total: 0, present: 0, apology: 0 };

      bucket.total += 1;
      if (record.status === "present") {
        bucket.present += 1;
        bucket.score += 1;
      } else if (record.status === "apology") {
        bucket.apology += 1;
        bucket.score += 0.5;
      }
      map.set(day, bucket);
    });

    return DAY_ORDER.filter((day) => map.has(day)).map((day) => {
      const entry = map.get(day)!;
      return {
        day: entry.label,
        attendancePercentage: entry.total === 0 ? 0 : Math.round((entry.score / entry.total) * 100),
      };
    });
  }, [attendance, meetings]);

  const colorPalette = ["#16a34a", "#f97316", "#dc2626", "#7c3aed", "#0891b2"];

  return (
    <div className="space-y-6">
      <div className="h-96 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="overall"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
              name="Overall"
            />
            {selectedMemberIds.map((memberId, index) => {
              const member = members.find((item) => item.id === memberId);
              return (
                <Line
                  key={memberId}
                  type="monotone"
                  dataKey={memberId}
                  stroke={colorPalette[index % colorPalette.length]}
                  strokeWidth={2}
                  dot={false}
                  name={member ? member.full_name : `Member ${index + 1}`}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-80 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={meetingTypeData}
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
              >
                {meetingTypeData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="h-80 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dayPatternData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="attendancePercentage" fill="#0ea5e9" name="Attendance %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}


