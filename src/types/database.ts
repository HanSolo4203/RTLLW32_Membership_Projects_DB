import type { Database as SupabaseDatabase } from '../../supabase/types';

export type Database = SupabaseDatabase;

export type Tables = Database['public']['Tables'];
export type Views = Database['public']['Views'];

export type Member = Tables['members']['Row'];
export type MemberInsert = Tables['members']['Insert'];
export type MemberUpdate = Tables['members']['Update'];

export type Meeting = Tables['meetings']['Row'];
export type MeetingInsert = Tables['meetings']['Insert'];
export type MeetingUpdate = Tables['meetings']['Update'];

export type Attendance = Tables['attendance']['Row'];
export type AttendanceInsert = Tables['attendance']['Insert'];
export type AttendanceUpdate = Tables['attendance']['Update'];

export type Guest = Tables['guests']['Row'];
export type GuestInsert = Tables['guests']['Insert'];
export type GuestUpdate = Tables['guests']['Update'];

export type GuestEvent = Tables['guest_events']['Row'];
export type GuestEventInsert = Tables['guest_events']['Insert'];
export type GuestEventUpdate = Tables['guest_events']['Update'];

export type Pipeliner = Tables['pipeliners']['Row'];
export type PipelinerInsert = Tables['pipeliners']['Insert'];
export type PipelinerUpdate = Tables['pipeliners']['Update'];

export type CharityEvent = Tables['charity_events']['Row'];
export type CharityEventInsert = Tables['charity_events']['Insert'];
export type CharityEventUpdate = Tables['charity_events']['Update'];

export type MemberAttendanceSummary =
  Views['member_attendance_summary']['Row'];
export type GuestMeetingCounts = Views['guest_meeting_counts']['Row'] & {
  charity_event_count?: number | null;
};
export type PipelinerEligibility = Views['pipeliner_eligibility']['Row'];

