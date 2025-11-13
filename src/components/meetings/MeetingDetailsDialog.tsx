"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDaysIcon, MapPinIcon, NotebookIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { Attendance } from "@/types/database";
import type { MeetingRecord } from "@/hooks/useMeetings";
import { getMeetingTypeLabel, meetingTypeStyles } from "@/components/meetings/constants";
import { cn } from "@/lib/utils";

type MeetingDetailsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: MeetingRecord | null;
  onEdit: (meeting: MeetingRecord) => void;
  onDelete: (meeting: MeetingRecord) => Promise<void>;
  deleting?: boolean;
  processing?: boolean;
};

type MeetingAttendee = {
  id: string;
  fullName: string;
  status: Attendance["status"];
  role: "member" | "guest" | "pipeliner";
  notes: string | null;
};

const statusThemes: Record<
  Attendance["status"],
  { label: string; badge: string; chip: string }
> = {
  present: {
    label: "Present",
    badge: "border-emerald-200 bg-emerald-100 text-emerald-700",
    chip: "bg-emerald-50 text-emerald-700",
  },
  apology: {
    label: "Apology",
    badge: "border-amber-200 bg-amber-100 text-amber-700",
    chip: "bg-amber-50 text-amber-800",
  },
  absent: {
    label: "Absent",
    badge: "border-rose-200 bg-rose-100 text-rose-700",
    chip: "bg-rose-50 text-rose-700",
  },
};

const roleLabels: Record<MeetingAttendee["role"], string> = {
  member: "Member",
  guest: "Guest",
  pipeliner: "Pipeliner",
};

export function MeetingDetailsDialog({
  open,
  onOpenChange,
  meeting,
  onEdit,
  onDelete,
  deleting = false,
  processing = false,
}: MeetingDetailsDialogProps) {
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAttendance = useCallback(async () => {
    if (!meeting) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("attendance")
        .select(
          `
          id,
          status,
          notes,
          created_at,
          member:members!attendance_member_id_fkey (
            id,
            full_name
          ),
          guest:guests!attendance_guest_id_fkey (
            id,
            full_name
          ),
          pipeliner:pipeliners!attendance_pipeliner_id_fkey (
            id,
            full_name
          )
        `
        )
        .eq("meeting_id", meeting.id)
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      const mapped =
        data?.map((row) => {
          const member = row.member as { id: string; full_name: string } | null;
          const guest = row.guest as { id: string; full_name: string } | null;
          const pipeliner = row.pipeliner as { id: string; full_name: string } | null;

          let role: MeetingAttendee["role"];
          let fullName: string;

          if (member) {
            role = "member";
            fullName = member.full_name;
          } else if (guest) {
            role = "guest";
            fullName = guest.full_name;
          } else if (pipeliner) {
            role = "pipeliner";
            fullName = pipeliner.full_name;
          } else {
            role = "member";
            fullName = "Unknown attendee";
          }

          return {
            id: row.id,
            fullName,
            role,
            status: row.status as Attendance["status"],
            notes: row.notes ?? null,
          };
        }) ?? [];

      setAttendees(mapped);
    } catch (error) {
      console.error("Failed to load meeting attendance", error);
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load attendance records right now."
      );
    } finally {
      setLoading(false);
    }
  }, [meeting]);

  useEffect(() => {
    if (open && meeting) {
      void loadAttendance();
    } else if (!open) {
      setAttendees([]);
      setError(null);
    }
  }, [open, meeting, loadAttendance]);

  const summary = useMemo(() => {
    if (attendees.length === 0) {
      return {
        total: meeting?.attendanceSummary.total ?? 0,
        present: meeting?.attendanceSummary.present ?? 0,
        apology: meeting?.attendanceSummary.apology ?? 0,
        absent: meeting?.attendanceSummary.absent ?? 0,
      };
    }

    return attendees.reduce(
      (acc, attendee) => {
        acc.total += 1;
        acc[attendee.status] += 1;
        return acc;
      },
      { total: 0, present: 0, apology: 0, absent: 0 }
    );
  }, [attendees, meeting?.attendanceSummary]);

  const groupedAttendees = useMemo(() => {
    const memberPresent: MeetingAttendee[] = [];
    const memberOther: MeetingAttendee[] = [];
    const pipelinersAndGuests: MeetingAttendee[] = [];

    for (const attendee of attendees) {
      if (attendee.role === "member") {
        if (attendee.status === "present") {
          memberPresent.push(attendee);
        } else {
          memberOther.push(attendee);
        }
      } else {
        pipelinersAndGuests.push(attendee);
      }
    }

    const sortByName = (list: MeetingAttendee[]) =>
      [...list].sort((a, b) => a.fullName.localeCompare(b.fullName));

    return {
      memberPresent: sortByName(memberPresent),
      memberOther: sortByName(memberOther),
      pipelinersAndGuests: sortByName(pipelinersAndGuests),
    };
  }, [attendees]);

  const meetingDate = meeting ? parseISO(meeting.meeting_date) : null;
  const typeStyle = meeting
    ? meetingTypeStyles[meeting.meeting_type as keyof typeof meetingTypeStyles] ??
      meetingTypeStyles.business
    : meetingTypeStyles.business;

  const handleDelete = async () => {
    if (!meeting) return;

    const confirmed = window.confirm(
      "This will remove the meeting and all related attendance records. Continue?"
    );

    if (!confirmed) return;

    try {
      await onDelete(meeting);
      toast.success("Meeting deleted.");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to delete meeting", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to delete the meeting. Please try again."
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-lg font-semibold">
            <UsersIcon className="size-5 text-primary" />
            Meeting Details
            {meeting && (
              <Badge className={cn("ml-auto", typeStyle.badge)}>
                {getMeetingTypeLabel(meeting.meeting_type as keyof typeof meetingTypeStyles)}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Review the agenda, capture attendance insights, and jump into detailed tracking.
          </DialogDescription>
        </DialogHeader>

        {meeting ? (
          <div className="space-y-6 overflow-y-auto pr-1">
            <section className="rounded-xl border bg-muted/40 p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <CalendarDaysIcon className="size-4 text-muted-foreground" />
                  {meetingDate ? format(meetingDate, "EEEE, d MMMM yyyy") : "Date TBC"}
                </span>
                <span className="flex items-center gap-2">
                  <MapPinIcon className="size-4 text-muted-foreground" />
                  {meeting.location ?? "Venue to be confirmed"}
                </span>
                <span className="flex items-center gap-2">
                  <NotebookIcon className="size-4 text-muted-foreground" />
                  {meeting.notes ? (
                    <span className="max-w-xl truncate">{meeting.notes}</span>
                  ) : (
                    "No notes captured yet"
                  )}
                </span>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-muted-foreground">
                Attendance Summary
              </h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="gap-3 rounded-2xl border-primary/10 bg-primary/5 py-4 text-primary">
                  <CardHeader className="px-4">
                    <CardTitle className="text-sm font-medium uppercase tracking-wide">
                      Total Responses
                    </CardTitle>
                    <CardDescription className="text-xs uppercase text-primary/70">
                      Present + apologies + absences
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4">
                    <p className="text-3xl font-semibold">{summary.total}</p>
                  </CardContent>
                </Card>
                <Card className="gap-3 rounded-2xl border-emerald-200 bg-emerald-50 py-4 text-emerald-700">
                  <CardHeader className="px-4">
                    <CardTitle className="text-sm font-medium uppercase tracking-wide">
                      Present
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4">
                    <p className="text-3xl font-semibold">{summary.present}</p>
                  </CardContent>
                </Card>
                <Card className="gap-3 rounded-2xl border-amber-200 bg-amber-50 py-4 text-amber-700">
                  <CardHeader className="px-4">
                    <CardTitle className="text-sm font-medium uppercase tracking-wide">
                      Apologies
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4">
                    <p className="text-3xl font-semibold">{summary.apology}</p>
                  </CardContent>
                </Card>
                <Card className="gap-3 rounded-2xl border-rose-200 bg-rose-50 py-4 text-rose-700">
                  <CardHeader className="px-4">
                    <CardTitle className="text-sm font-medium uppercase tracking-wide">
                      Absent
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4">
                    <p className="text-3xl font-semibold">{summary.absent}</p>
                  </CardContent>
                </Card>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Attendees ({attendees.length})
                </h3>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <Link href={`/meetings/${meeting.id}/attendance`}>
                    <UsersIcon className="size-4" />
                    Go to Attendance Page
                  </Link>
                </Button>
              </div>

              <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
                {loading && (
                  <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                    Loading attendee list…
                  </p>
                )}

                {error && (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}

                {!loading && !error && attendees.length === 0 && (
                  <p className="rounded-lg border border-dashed border-muted px-3 py-6 text-center text-sm text-muted-foreground">
                    No attendance captured yet. Use the attendance page to start marking responses.
                  </p>
                )}

                {!loading && !error && attendees.length > 0 && (
                  <>
                    {groupedAttendees.memberPresent.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Members Present ({groupedAttendees.memberPresent.length})
                          </h4>
                        </div>
                        <div className="mt-2 space-y-2">
                          {groupedAttendees.memberPresent.map((attendee) => {
                            const statusTheme = statusThemes[attendee.status];
                            return (
                              <div
                                key={attendee.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background px-4 py-3 shadow-sm"
                              >
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    {attendee.fullName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {roleLabels[attendee.role]}
                                  </p>
                                  {attendee.notes && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {attendee.notes}
                                    </p>
                                  )}
                                </div>
                                <Badge className={cn(statusTheme.badge)}>
                                  {statusTheme.label}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {groupedAttendees.memberOther.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Members · Apologies & Absences ({groupedAttendees.memberOther.length})
                          </h4>
                        </div>
                        <div className="mt-2 space-y-2">
                          {groupedAttendees.memberOther.map((attendee) => {
                            const statusTheme = statusThemes[attendee.status];
                            return (
                              <div
                                key={attendee.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background px-4 py-3 shadow-sm"
                              >
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    {attendee.fullName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {roleLabels[attendee.role]}
                                  </p>
                                  {attendee.notes && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {attendee.notes}
                                    </p>
                                  )}
                                </div>
                                <Badge className={cn(statusTheme.badge)}>
                                  {statusTheme.label}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {groupedAttendees.pipelinersAndGuests.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Guests &amp; Pipeliners ({groupedAttendees.pipelinersAndGuests.length})
                          </h4>
                        </div>
                        <div className="mt-2 space-y-2">
                          {groupedAttendees.pipelinersAndGuests.map((attendee) => {
                            const statusTheme = statusThemes[attendee.status];
                            return (
                              <div
                                key={attendee.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background px-4 py-3 shadow-sm"
                              >
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    {attendee.fullName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {roleLabels[attendee.role]}
                                  </p>
                                  {attendee.notes && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {attendee.notes}
                                    </p>
                                  )}
                                </div>
                                <Badge className={cn(statusTheme.badge)}>
                                  {statusTheme.label}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-muted px-3 py-6 text-center text-sm text-muted-foreground">
            Select a meeting to see its full details.
          </p>
        )}

        <DialogFooter className="mt-4 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => meeting && onEdit(meeting)}
            disabled={!meeting || deleting || processing}
          >
            Edit Meeting
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={!meeting || deleting || processing}
          >
            {deleting ? "Deleting…" : "Delete Meeting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MeetingDetailsDialog;


