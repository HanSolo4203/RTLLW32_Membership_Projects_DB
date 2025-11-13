"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckCircle2Icon,
  HeartHandshakeIcon,
  Loader2Icon,
  PartyPopperIcon,
  ShieldCheckIcon,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  BUSINESS_MEETING_TARGET,
  CHARITY_EVENT_TARGET,
  getPipelinerBusinessMeetingCount,
  getPipelinerCharityEventCount,
  hasMetMembershipRequirements,
} from "@/lib/pipelinerEligibility";
import type { PipelinerEligibility } from "@/types/database";

type PromoteToMemberDialogProps = {
  pipeliner: PipelinerEligibility | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPromote: (payload: { member_number: string; join_date: string }) => Promise<void>;
  promoting: boolean;
};

function formatStatusBadge(pipeliner: PipelinerEligibility | null) {
  if (!pipeliner) return "Status Unknown";

  if (pipeliner.status === "became_member") {
    return "Became Member";
  }

  if (
    pipeliner &&
    (hasMetMembershipRequirements(pipeliner) ||
      pipeliner.is_eligible_for_membership)
  ) {
    return "Eligible for Membership";
  }

  return "Active";
}

function badgeClassName(pipeliner: PipelinerEligibility | null) {
  if (!pipeliner) {
    return "bg-slate-100 border-slate-200 text-slate-700";
  }

  if (pipeliner.status === "became_member") {
    return "bg-indigo-100 border-indigo-200 text-indigo-700";
  }

  if (
    pipeliner &&
    (hasMetMembershipRequirements(pipeliner) ||
      pipeliner.is_eligible_for_membership)
  ) {
    return "bg-emerald-100 border-emerald-200 text-emerald-700";
  }

  return "bg-amber-100 border-amber-200 text-amber-700";
}

async function triggerConfetti() {
  const confetti = (await import("canvas-confetti")).default;
  confetti({
    particleCount: 200,
    spread: 70,
    origin: { y: 0.7 },
    colors: ["#0ea5e9", "#22c55e", "#fbbf24", "#a855f7"],
    disableForReducedMotion: true,
  });
}

async function playCelebrationChime() {
  if (typeof window === "undefined") return;

  const AudioContextClass =
    typeof window.AudioContext !== "undefined"
      ? window.AudioContext
      : (window as typeof window & { webkitAudioContext?: typeof window.AudioContext })
          .webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(660, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.25);

  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.00001, context.currentTime + 0.5);

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start();
  oscillator.stop(context.currentTime + 0.55);

  setTimeout(() => {
    void context.close();
  }, 750);
}

export default function PromoteToMemberDialog({
  pipeliner,
  open,
  onOpenChange,
  onPromote,
  promoting,
}: PromoteToMemberDialogProps) {
  const [memberNumber, setMemberNumber] = useState("");
  const [joinDate, setJoinDate] = useState(() => new Date().toISOString().split("T")[0]);

  const eligible = useMemo(() => {
    if (!pipeliner) return false;
    if (pipeliner.status === "became_member") {
      return false;
    }
    return Boolean(
      hasMetMembershipRequirements(pipeliner) ||
        pipeliner.is_eligible_for_membership,
    );
  }, [pipeliner]);

  useEffect(() => {
    if (open && pipeliner) {
      setMemberNumber("");
      setJoinDate(new Date().toISOString().split("T")[0]);
    } else if (!open) {
      setMemberNumber("");
      setJoinDate(new Date().toISOString().split("T")[0]);
    }
  }, [open, pipeliner]);

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && !promoting) {
        onOpenChange(false);
      } else {
        onOpenChange(nextOpen);
      }
    },
    [onOpenChange, promoting]
  );

  const handleConfirm = useCallback(async () => {
    if (!pipeliner) return;

    if (!eligible) {
      toast.error("This pipeliner has not met the membership requirements yet.");
      return;
    }

    if (!memberNumber.trim()) {
      toast.error("Member number is required.");
      return;
    }

    if (!joinDate) {
      toast.error("Official join date is required.");
      return;
    }

    try {
      await onPromote({
        member_number: memberNumber.trim(),
        join_date: joinDate,
      });

      toast.success(`${pipeliner.full_name} is now a full member!`);
      await Promise.allSettled([triggerConfetti(), playCelebrationChime()]);
      handleClose(false);
    } catch (error) {
      console.error("Promotion failed", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to promote this pipeliner right now."
      );
    }
  }, [eligible, handleClose, joinDate, memberNumber, onPromote, pipeliner]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheckIcon className="size-5 text-emerald-500" />
            Promote to Member
          </DialogTitle>
          <DialogDescription>
            Celebrate this milestone by capturing the official membership details and confirming eligibility.
          </DialogDescription>
        </DialogHeader>

        {pipeliner ? (
          <div className="space-y-6">
            <div
              className={cn(
                "rounded-xl border bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 shadow-sm",
                eligible
                  ? "border-emerald-200"
                  : "border-slate-200"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    {pipeliner.full_name}
                  </p>
                  <p className="text-xs text-muted-foreground">{pipeliner.email ?? "No email recorded"}</p>
                  <p className="text-xs text-muted-foreground">{pipeliner.phone ?? "No phone on file"}</p>
                </div>
                <Badge className={cn("border text-xs font-semibold", badgeClassName(pipeliner))}>
                  {formatStatusBadge(pipeliner)}
                </Badge>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:text-sm">
                <div className="rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2 shadow-sm">
                  <dt className="flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-wide text-slate-500">
                    <CheckCircle2Icon className="size-3.5 text-emerald-500" />
                    Business Meetings
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">
                    {getPipelinerBusinessMeetingCount(pipeliner)} /{" "}
                    {BUSINESS_MEETING_TARGET} attended
                  </dd>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2 shadow-sm">
                  <dt className="flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-wide text-slate-500">
                    <HeartHandshakeIcon className="size-3.5 text-rose-500" />
                    Charity Events
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">
                    {getPipelinerCharityEventCount(pipeliner)} /{" "}
                    {CHARITY_EVENT_TARGET} hosted
                  </dd>
                </div>
              </dl>

              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarIcon className="size-3.5" />
                Last updated {new Date(pipeliner.updated_at).toLocaleDateString()}
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 bg-white/80 p-4 shadow-inner">
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Member Number
                <Input
                  value={memberNumber}
                  onChange={(event) => setMemberNumber(event.target.value)}
                  placeholder="Enter the assigned member number"
                  disabled={promoting}
                  required
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Official Join Date
                <div className="relative">
                  <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="date"
                    value={joinDate}
                    onChange={(event) => setJoinDate(event.target.value)}
                    className="pl-10"
                    disabled={promoting}
                    required
                  />
                </div>
              </label>

              <div className="rounded-md border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-800">
                <p className="font-semibold uppercase tracking-wide">Eligibility Snapshot</p>
                <p className="mt-1 leading-relaxed">
                  {eligible
                    ? "All requirements are met! Lock in the celebration by completing the promotion."
                    : "This pipeliner needs at least 3 business meetings and 1 charity event before promotion."}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-muted-foreground">
            Select a pipeliner to begin the promotion flow.
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={promoting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!pipeliner || promoting || !eligible}
            className={cn(
              "transition-all",
              eligible
                ? "bg-emerald-600 hover:bg-emerald-500"
                : "bg-slate-400 hover:bg-slate-400"
            )}
          >
            {promoting ? (
              <Loader2Icon className="mr-2 size-4 animate-spin" />
            ) : (
              <PartyPopperIcon className="mr-2 size-4" />
            )}
            <span>Confirm Promotion</span>
            <ArrowRightIcon className="ml-2 size-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


