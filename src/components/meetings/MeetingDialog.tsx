"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, CalendarPlusIcon, PencilIcon, SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { format, formatISO, isValid, isWithinInterval, parse, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MEETING_TYPES, MEETING_WINDOW, type MeetingFormValues, type MeetingRecord } from "@/hooks/useMeetings";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseMeetingDate(value: string) {
  if (!value) return null;

  if (ISO_DATE_REGEX.test(value)) {
    const parsed = parseISO(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const fallbackFormats = ["dd/MM/yyyy", "d/M/yyyy"];

  for (const formatString of fallbackFormats) {
    const parsed = parse(value, formatString, new Date());
    if (isValid(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeMeetingDate(value: string) {
  const parsed = parseMeetingDate(value);
  if (!parsed) return null;

  return formatISO(parsed, { representation: "date" });
}

const MEETING_WINDOW_START_LABEL = format(MEETING_WINDOW.start, "MMMM d, yyyy");
const MEETING_WINDOW_END_LABEL = format(MEETING_WINDOW.end, "MMMM d, yyyy");
const MEETING_WINDOW_MIN_DATE = format(MEETING_WINDOW.start, "yyyy-MM-dd");
const MEETING_WINDOW_MAX_DATE = format(MEETING_WINDOW.end, "yyyy-MM-dd");

const today = new Date();
const DEFAULT_MEETING_DATE = formatISO(
  isWithinInterval(today, MEETING_WINDOW) ? today : MEETING_WINDOW.start,
  { representation: "date" },
);

const meetingSchema = z
  .object({
    meeting_date: z
      .string()
      .min(1, "Meeting date is required.")
      .transform((value, ctx) => {
        const normalized = normalizeMeetingDate(value);
        if (!normalized) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Enter a valid meeting date.",
          });
          return z.NEVER;
        }

        return normalized;
      }),
    location: z
      .string()
      .optional()
      .transform((value) => value?.trim() ?? ""),
    meeting_type: z.enum(["business", "charity", "special"]),
    notes: z
      .string()
      .optional()
      .transform((value) => value?.trim() ?? ""),
  })
  .refine(
    (values) => {
      const parsed = parseMeetingDate(values.meeting_date);
      if (!parsed) return false;
      return isWithinInterval(parsed, MEETING_WINDOW);
    },
    {
      path: ["meeting_date"],
      message: `Meeting date must be between ${MEETING_WINDOW_START_LABEL} and ${MEETING_WINDOW_END_LABEL}.`,
    }
  );

type MeetingSchema = z.infer<typeof meetingSchema>;

type MeetingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "create" | "edit";
  submitHandler: (values: MeetingFormValues) => Promise<MeetingRecord>;
  meeting?: MeetingRecord | null;
  loading?: boolean;
};

export function MeetingDialog({
  open,
  onOpenChange,
  mode = "create",
  submitHandler,
  meeting = null,
  loading = false,
}: MeetingDialogProps) {
  const router = useRouter();

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MeetingSchema>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      meeting_date: meeting?.meeting_date
        ? meeting.meeting_date.slice(0, 10)
        : DEFAULT_MEETING_DATE,
      location: meeting?.location ?? "",
      meeting_type: (meeting?.meeting_type as MeetingFormValues["meeting_type"]) ?? "business",
      notes: meeting?.notes ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        meeting_date: meeting?.meeting_date
          ? meeting.meeting_date.slice(0, 10)
          : DEFAULT_MEETING_DATE,
        location: meeting?.location ?? "",
        meeting_type: (meeting?.meeting_type as MeetingFormValues["meeting_type"]) ?? "business",
        notes: meeting?.notes ?? "",
      });
    }
  }, [meeting, open, reset]);

  const meetingDateValue = watch("meeting_date");
  const derivedMonth = meetingDateValue
    ? format(parseISO(meetingDateValue), "MMMM")
    : "—";
  const derivedYear = meetingDateValue
    ? format(parseISO(meetingDateValue), "yyyy")
    : "—";

  const onSubmit = handleSubmit(async (values) => {
    const payload: MeetingFormValues = {
      meeting_date: values.meeting_date,
      meeting_type: values.meeting_type,
      location: values.location?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
    };

    try {
      const record = await submitHandler(payload);

      if (mode === "create") {
        toast.success("Meeting created successfully.", {
          description: `${record.meeting_month} ${record.meeting_year} · ${record.location ?? "Location TBC"}`,
          action: {
            label: "Mark Attendance Now",
            onClick: () => router.push(`/meetings/${record.id}/attendance`),
          },
        });
      } else {
        toast.success("Meeting updated successfully.");
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Meeting dialog submission failed", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong while saving the meeting."
      );
    }
  });

  const dialogTitle =
    mode === "create" ? "Create New Meeting" : "Update Meeting Details";
  const dialogDescription =
    mode === "create"
      ? "Capture the basics for the next Round Table meeting."
      : "Make adjustments to this meeting before members are notified.";

  const primaryIcon =
    mode === "create" ? (
      <CalendarPlusIcon className="size-5 text-primary" />
    ) : (
      <PencilIcon className="size-5 text-primary" />
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            {primaryIcon}
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit();
          }}
        >
          <div className="grid gap-2">
            <label htmlFor="meeting_date" className="text-sm font-medium">
              Meeting Date
            </label>
            <Controller
              control={control}
              name="meeting_date"
              render={({ field }) => (
                <div className="relative">
                  <Input
                    id="meeting_date"
                    type="date"
                    min={MEETING_WINDOW_MIN_DATE}
                    max={MEETING_WINDOW_MAX_DATE}
                    aria-invalid={!!errors.meeting_date}
                    {...field}
                  />
                  <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              )}
            />
            {errors.meeting_date?.message && (
              <p className="text-xs text-destructive">
                {errors.meeting_date.message}
              </p>
            )}
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Month</label>
              <Input value={derivedMonth} readOnly />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Year</label>
              <Input value={derivedYear} readOnly />
            </div>
          </div>

          <div className="grid gap-2">
            <label htmlFor="location" className="text-sm font-medium">
              Location
            </label>
            <Controller
              control={control}
              name="location"
              render={({ field }) => (
                <Input
                  id="location"
                  placeholder="e.g. Table View Community Hall"
                  aria-invalid={!!errors.location}
                  {...field}
                />
              )}
            />
            {errors.location?.message && (
              <p className="text-xs text-destructive">
                {errors.location.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Meeting Type</label>
            <Controller
              control={control}
              name="meeting_type"
              render={({ field }) => (
                <Select
                  value={field.value}
                  defaultValue={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger aria-invalid={!!errors.meeting_type}>
                    <SelectValue placeholder="Select meeting type" />
                  </SelectTrigger>
                  <SelectContent>
                    {MEETING_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.meeting_type?.message && (
              <p className="text-xs text-destructive">
                {errors.meeting_type.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <label htmlFor="notes" className="text-sm font-medium">
              Notes
            </label>
            <Controller
              control={control}
              name="notes"
              render={({ field }) => (
                <textarea
                  id="notes"
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Agenda, visiting guests, key reminders…"
                  aria-invalid={!!errors.notes}
                  {...field}
                />
              )}
            />
            {errors.notes?.message && (
              <p className="text-xs text-destructive">
                {errors.notes.message}
              </p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || loading}>
              <SaveIcon className="mr-2 size-4" />
              {mode === "create" ? "Save Meeting" : "Update Meeting"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default MeetingDialog;


