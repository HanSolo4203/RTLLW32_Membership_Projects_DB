"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, SaveIcon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

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
import type { MemberAttendanceSummary } from "@/types/database";
import type { MemberFormValues } from "@/hooks/useMembers";

const memberSchema = z.object({
  full_name: z.string().min(2, "Full name must be at least 2 characters."),
  email: z
    .string()
    .email("Please enter a valid email address.")
    .min(1, "Email is required."),
  phone: z
    .string()
    .optional()
    .transform((value) => value?.trim() || ""),
  member_number: z
    .string()
    .optional()
    .transform((value) => value?.trim() || ""),
  join_date: z.string().min(1, "Join date is required."),
  status: z.string().min(1, "Status is required."),
});

type MemberFormSchema = z.infer<typeof memberSchema>;

type MemberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: MemberAttendanceSummary | null;
  onSubmit: (values: MemberFormValues) => Promise<void>;
  mode?: "create" | "edit";
  loading?: boolean;
};

const DEFAULT_STATUSES = ["active", "inactive", "probation", "sabbatical"];

export function MemberDialog({
  open,
  onOpenChange,
  member,
  onSubmit,
  mode = "create",
  loading = false,
}: MemberDialogProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MemberFormSchema>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      full_name: member?.full_name ?? "",
      email: member?.email ?? "",
      phone: member?.phone ?? "",
      member_number: member?.member_number ?? "",
      join_date: member?.join_date
        ? member.join_date.slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      status: member?.status ?? "active",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        full_name: member?.full_name ?? "",
        email: member?.email ?? "",
        phone: member?.phone ?? "",
        member_number: member?.member_number ?? "",
        join_date: member?.join_date
          ? member.join_date.slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        status: member?.status ?? "active",
      });
    }
  }, [member, open, reset]);

  const statusOptions = useMemo(() => {
    const uniqueStatuses = new Set(DEFAULT_STATUSES);
    if (member?.status) {
      uniqueStatuses.add(member.status.toLowerCase());
    }
    return Array.from(uniqueStatuses);
  }, [member?.status]);

  const handleFormSubmit = handleSubmit(async (values) => {
    const payload: MemberFormValues = {
      full_name: values.full_name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim() || undefined,
      member_number: values.member_number.trim() || undefined,
      join_date: values.join_date,
      status: values.status,
    };

    try {
      await onSubmit(payload);
      toast.success(
        mode === "create" ? "Member added successfully." : "Member updated."
      );
      onOpenChange(false);
    } catch (error) {
      console.error("Member dialog submission error", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong while saving the member."
      );
    }
  });

  const dialogTitle = mode === "create" ? "Add New Member" : "Edit Member";
  const dialogDescription =
    mode === "create"
      ? "Capture basic details for a new Round Table member."
      : "Update the selected member's information and attendance details.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <UserPlusIcon className="size-5 text-primary" />
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleFormSubmit();
          }}
        >
          <div className="grid gap-2">
            <label htmlFor="full_name" className="text-sm font-medium">
              Full Name
            </label>
            <Controller
              control={control}
              name="full_name"
              render={({ field }) => (
                <Input
                  id="full_name"
                  placeholder="John Doe"
                  autoComplete="name"
                  aria-invalid={!!errors.full_name}
                  {...field}
                />
              )}
            />
            {errors.full_name?.message && (
              <p className="text-xs text-destructive">
                {errors.full_name.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email Address
            </label>
            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <Input
                  id="email"
                  placeholder="john@example.com"
                  type="email"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  {...field}
                />
              )}
            />
            {errors.email?.message && (
              <p className="text-xs text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <label htmlFor="phone" className="text-sm font-medium">
              Phone Number
            </label>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <Input
                  id="phone"
                  placeholder="+27 82 000 0000"
                  type="tel"
                  autoComplete="tel"
                  aria-invalid={!!errors.phone}
                  {...field}
                />
              )}
            />
            {errors.phone?.message && (
              <p className="text-xs text-destructive">
                {errors.phone.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <label htmlFor="member_number" className="text-sm font-medium">
              Member Number
            </label>
            <Controller
              control={control}
              name="member_number"
              render={({ field }) => (
                <Input
                  id="member_number"
                  placeholder="RT-123"
                  aria-invalid={!!errors.member_number}
                  {...field}
                />
              )}
            />
            {errors.member_number?.message && (
              <p className="text-xs text-destructive">
                {errors.member_number.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <label htmlFor="join_date" className="text-sm font-medium">
              Join Date
            </label>
            <Controller
              control={control}
              name="join_date"
              render={({ field }) => (
                <div className="relative">
                  <Input
                    id="join_date"
                    type="date"
                    aria-invalid={!!errors.join_date}
                    {...field}
                  />
                  <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              )}
            />
            {errors.join_date?.message && (
              <p className="text-xs text-destructive">
                {errors.join_date.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Status</label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  defaultValue={field.value}
                >
                  <SelectTrigger aria-invalid={!!errors.status}>
                    <SelectValue placeholder="Select a status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.status?.message && (
              <p className="text-xs text-destructive">
                {errors.status.message}
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
              {mode === "create" ? "Save Member" : "Update Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default MemberDialog;

