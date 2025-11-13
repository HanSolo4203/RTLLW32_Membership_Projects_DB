"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2Icon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";

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
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type MemberOption = {
  id: string;
  full_name: string;
  status: string;
};

type AddGuestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: MemberOption[];
  onCreated: () => Promise<void> | void;
};

type GuestFormState = {
  fullName: string;
  email: string;
  phone: string;
  invitedBy: string;
};

const initialState: GuestFormState = {
  fullName: "",
  email: "",
  phone: "",
  invitedBy: "",
};

export default function AddGuestDialog({
  open,
  onOpenChange,
  members,
  onCreated,
}: AddGuestDialogProps) {
  const [form, setForm] = useState<GuestFormState>(initialState);
  const [submitting, setSubmitting] = useState(false);

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    if (!open) {
      setForm(initialState);
      setSubmitting(false);
    }
  }, [open]);

  const activeMembers = useMemo(
    () => members.filter((member) => member.status !== "inactive"),
    [members],
  );

  const handleSubmit = useCallback(async () => {
    if (!form.fullName.trim()) {
      toast.error("Full name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        full_name: form.fullName.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        status: "active",
        invited_by: form.invitedBy || null,
        first_attendance: null,
        notes: null,
      };

      const { error } = await supabase.from("guests").insert(payload);
      if (error) {
        throw error;
      }

      toast.success("Guest added successfully.");
      await Promise.resolve(onCreated?.());
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to add guest", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to add the guest right now.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [form, onCreated, onOpenChange, supabase]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Guest</DialogTitle>
          <DialogDescription>
            Capture guest details to begin tracking their meeting attendance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Full Name
            <Input
              value={form.fullName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, fullName: event.target.value }))
              }
              placeholder="Guest name"
              disabled={submitting}
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Email (optional)
            <Input
              value={form.email}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, email: event.target.value }))
              }
              type="email"
              placeholder="guest@example.com"
              disabled={submitting}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Phone (optional)
            <Input
              value={form.phone}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, phone: event.target.value }))
              }
              placeholder="+27 82 000 0000"
              disabled={submitting}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Invited By (optional)
            <Select
              value={form.invitedBy}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, invitedBy: value }))
              }
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {activeMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <Loader2Icon className="mr-2 size-4 animate-spin" />
            ) : (
              <UserPlusIcon className="mr-2 size-4" />
            )}
            Save Guest
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


