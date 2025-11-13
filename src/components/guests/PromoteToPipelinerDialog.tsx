"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2Icon, PartyPopperIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import type { GuestMeetingCounts } from "@/types/database";

type MemberOption = {
  id: string;
  full_name: string;
  status: string;
};

type PromoteToPipelinerDialogProps = {
  guest: GuestMeetingCounts | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: MemberOption[];
  onPromoted: () => Promise<void> | void;
};

function fieldLabel(value: string | null | undefined, fallback = "—") {
  if (!value || !value.trim()) return fallback;
  return value;
}

export default function PromoteToPipelinerDialog({
  guest,
  open,
  onOpenChange,
  members,
  onPromoted,
}: PromoteToPipelinerDialogProps) {
  const router = useRouter();
  const [sponsorId, setSponsorId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const eligible = guest ? guest.meeting_count >= 3 || guest.eligible_for_pipeliner : false;

  useEffect(() => {
    if (open && guest) {
      setSponsorId(guest.invited_by ?? "");
      setNotes("");
    } else if (!open) {
      setSponsorId("");
      setNotes("");
    }
  }, [guest, open]);

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && !submitting) {
        onOpenChange(false);
      } else {
        onOpenChange(nextOpen);
      }
    },
    [onOpenChange, submitting],
  );

  const sponsorOptions = useMemo(
    () =>
      members
        .filter((member) => member.status !== "inactive")
        .map((member) => ({
          id: member.id,
          label: member.full_name,
        })),
    [members],
  );

  const triggerConfetti = useCallback(async () => {
    const confetti = (await import("canvas-confetti")).default;
    confetti({
      particleCount: 160,
      spread: 70,
      origin: { y: 0.7 },
      disableForReducedMotion: true,
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!guest) return;
    if (!sponsorId) {
      toast.error("Please select a sponsoring member.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        full_name: guest.full_name,
        email: guest.email,
        phone: guest.phone,
        promoted_from_guest_date: new Date().toISOString().split("T")[0],
        guest_meetings_count: Math.max(guest.meeting_count, 3),
        business_meetings_count: guest.present_count,
        status: "active",
        sponsored_by: sponsorId,
        notes: notes.trim() ? notes.trim() : null,
        is_eligible_for_membership: false,
      };

      const { data: inserted, error: insertError } = await supabase
        .from("pipeliners")
        .insert(payload)
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      const { error: guestUpdateError } = await supabase
        .from("guests")
        .update({
          status: "became_pipeliner",
          total_meetings: Math.max(guest.total_meetings ?? 0, 3),
          updated_at: new Date().toISOString(),
        })
        .eq("id", guest.id);

      if (guestUpdateError) {
        if (inserted?.id) {
          await supabase.from("pipeliners").delete().eq("id", inserted.id);
        }
        throw guestUpdateError;
      }

      toast.success(`${guest.full_name} promoted to pipeliner!`);
      await triggerConfetti();
      await Promise.resolve(onPromoted?.());
      handleClose(false);
      router.push("/pipeliners");
    } catch (error) {
      console.error("Failed to promote guest to pipeliner", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to promote guest right now. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    guest,
    handleClose,
    notes,
    onPromoted,
    router,
    sponsorId,
    supabase,
    triggerConfetti,
  ]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Promote to Pipeliner</DialogTitle>
          <DialogDescription>
            Confirm the guest details and assign a sponsoring member to complete the promotion
            workflow.
          </DialogDescription>
        </DialogHeader>

        {guest ? (
          <div className="space-y-5 py-2">
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{guest.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Invited by{" "}
                    <span className="font-medium">
                      {fieldLabel(
                        members.find((member) => member.id === guest.invited_by)?.full_name,
                        "Unknown member",
                      )}
                    </span>
                  </p>
                </div>
                <Badge
                  className={cn(
                    "border-emerald-200 bg-emerald-100/80 text-emerald-700",
                    !eligible && "border-amber-200 bg-amber-100/80 text-amber-700",
                  )}
                >
                  {eligible ? "Eligible!" : "Needs 3 meetings"}
                </Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:text-sm">
                <div>
                  <dt className="font-medium text-slate-700">Email</dt>
                  <dd className="text-muted-foreground">{fieldLabel(guest.email)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700">Phone</dt>
                  <dd className="text-muted-foreground">{fieldLabel(guest.phone)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700">Meetings Attended</dt>
                  <dd className="text-muted-foreground">{guest.meeting_count}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700">Status</dt>
                  <dd className="text-muted-foreground capitalize">{guest.status.replaceAll("_", " ")}</dd>
                </div>
              </dl>
            </div>

            <div className="space-y-3">
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Sponsored By
                <Select value={sponsorId} onValueChange={setSponsorId} disabled={submitting}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select sponsoring member" />
                  </SelectTrigger>
                  <SelectContent>
                    {sponsorOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Additional Notes (optional)
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  disabled={submitting}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Add any context for the pipeliner committee..."
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No guest selected for promotion.
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={submitting || !guest}>
            {submitting ? (
              <Loader2Icon className="mr-2 size-4 animate-spin" />
            ) : (
              <PartyPopperIcon className="mr-2 size-4" />
            )}
            Promote to Pipeliner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


