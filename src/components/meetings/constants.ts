import { MEETING_TYPES, type MeetingTypeValue } from "@/hooks/useMeetings";

export const meetingTypeStyles: Record<
  MeetingTypeValue,
  { badge: string; subtle: string; accent: string }
> = {
  business: {
    badge: "border-emerald-200 bg-emerald-100 text-emerald-700",
    subtle: "bg-emerald-50 text-emerald-700",
    accent: "text-emerald-600",
  },
  charity: {
    badge: "border-amber-200 bg-amber-100 text-amber-800",
    subtle: "bg-amber-50 text-amber-800",
    accent: "text-amber-700",
  },
  special: {
    badge: "border-indigo-200 bg-indigo-100 text-indigo-800",
    subtle: "bg-indigo-50 text-indigo-800",
    accent: "text-indigo-700",
  },
};

export function getMeetingTypeLabel(value: MeetingTypeValue) {
  return MEETING_TYPES.find((option) => option.value === value)?.label ?? value;
}


