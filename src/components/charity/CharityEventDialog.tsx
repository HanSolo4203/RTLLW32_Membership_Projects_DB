"use client";

import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import { CalendarIcon, HeartHandshakeIcon, Loader2Icon, UsersIcon } from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  BUSINESS_MEETING_TARGET,
  CHARITY_EVENT_TARGET,
  getPipelinerBusinessMeetingCount,
  getPipelinerCharityEventCount,
  hasMetMembershipRequirements,
} from "@/lib/pipelinerEligibility";
import type { PipelinerEligibility } from "@/types/database";

type ParticipantOption = {
  id: string;
  label: string;
  type: "member" | "pipeliner";
  subtitle?: string | null;
};

type CharityEventDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: ParticipantOption[];
  pipeliners: PipelinerEligibility[];
  onCreate: (
    payload: {
      event_name: string;
      event_date: string;
      description?: string | null;
      participant_member_ids?: string[];
      participant_pipeliner_ids?: string[];
    }
  ) => Promise<void>;
  creating: boolean;
};

type FormState = {
  eventName: string;
  eventDate: string;
  description: string;
  selectedMemberIds: Set<string>;
  selectedPipelinerIds: Set<string>;
};

const initialState: FormState = {
  eventName: "",
  eventDate: new Date().toISOString().split("T")[0],
  description: "",
  selectedMemberIds: new Set<string>(),
  selectedPipelinerIds: new Set<string>(),
};

export default function CharityEventDialog({
  open,
  onOpenChange,
  members,
  pipeliners,
  onCreate,
  creating,
}: CharityEventDialogProps): JSX.Element {
  const [form, setForm] = useState<FormState>(initialState);

  useEffect(() => {
    if (open) {
      setForm({
        eventName: "",
        eventDate: new Date().toISOString().split("T")[0],
        description: "",
        selectedMemberIds: new Set<string>(),
        selectedPipelinerIds: new Set<string>(),
      });
    }
  }, [open]);

  const pipelinerOptions = useMemo<ParticipantOption[]>(() => {
    return pipeliners.map((pipeliner) => {
      const businessMeetings = getPipelinerBusinessMeetingCount(pipeliner);
      const charityEvents = getPipelinerCharityEventCount(pipeliner);
      const eligible = hasMetMembershipRequirements(pipeliner);

      return {
        id: pipeliner.id,
        label: pipeliner.full_name,
        type: "pipeliner" as const,
        subtitle: eligible
          ? `Eligible · ${businessMeetings}/${BUSINESS_MEETING_TARGET} meetings`
          : `${businessMeetings}/${BUSINESS_MEETING_TARGET} meetings · ${charityEvents}/${CHARITY_EVENT_TARGET} events`,
      };
    });
  }, [pipeliners]);

  const memberOptions = useMemo(() => members, [members]);

  const toggleParticipant = useCallback(
    (type: "member" | "pipeliner", id: string) => {
      setForm((previous) => {
        const field =
          type === "member" ? previous.selectedMemberIds : previous.selectedPipelinerIds;
        const next = new Set(field);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }

        return {
          ...previous,
          selectedMemberIds:
            type === "member" ? next : new Set(previous.selectedMemberIds),
          selectedPipelinerIds:
            type === "pipeliner" ? next : new Set(previous.selectedPipelinerIds),
        };
      });
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (!form.eventName.trim()) {
      toast.error("Event name is required.");
      return;
    }

    if (!form.eventDate) {
      toast.error("Please select an event date.");
      return;
    }

    try {
      await onCreate({
        event_name: form.eventName.trim(),
        event_date: form.eventDate,
        description: form.description.trim() || null,
        participant_member_ids: Array.from(form.selectedMemberIds),
        participant_pipeliner_ids: Array.from(form.selectedPipelinerIds),
      });

      toast.success("Charity event recorded successfully.");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to record charity event", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save the charity event right now."
      );
    }
  }, [form.description, form.eventDate, form.eventName, form.selectedMemberIds, form.selectedPipelinerIds, onCreate, onOpenChange]);

  const participantCount =
    form.selectedMemberIds.size + form.selectedPipelinerIds.size;

  const hasParticipants = participantCount > 0;

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && !creating) {
        onOpenChange(false);
      } else {
        onOpenChange(nextOpen);
      }
    },
    [creating, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <HeartHandshakeIcon className="size-5 text-rose-500" />
            Record Charity Event
          </DialogTitle>
          <DialogDescription>
            Capture the details of the charity initiative and celebrate the participants that made it happen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Event Name
              <Input
                value={form.eventName}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, eventName: event.target.value }))
                }
                placeholder="Community outreach at Green Valley"
                disabled={creating}
                required
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Event Date
              <div className="relative">
                <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={form.eventDate}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, eventDate: event.target.value }))
                  }
                  className="pl-10"
                  disabled={creating}
                  required
                />
              </div>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Description (optional)
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, description: event.target.value }))
              }
              rows={3}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Share the impact, beneficiaries, or key highlights from the event."
              disabled={creating}
            />
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UsersIcon className="size-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-700">
                  Participants ({participantCount})
                </span>
              </div>
              <span
                className={cn(
                  "rounded-full bg-white px-3 py-1 text-xs font-medium shadow-sm",
                  hasParticipants ? "text-emerald-600" : "text-slate-400"
                )}
              >
                {hasParticipants ? "Ready to celebrate" : "Select people to credit"}
              </span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Pipeliners
                </h4>
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {pipelinerOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No pipeliners available.</p>
                  ) : (
                    pipelinerOptions.map((option) => {
                      const checked = form.selectedPipelinerIds.has(option.id);
                      return (
                        <label
                          key={option.id}
                          className={cn(
                            "flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm transition",
                            checked
                              ? "border-emerald-300 bg-emerald-50/80 text-emerald-800 shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          )}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{option.label}</span>
                            {option.subtitle ? (
                              <span className="text-xs text-muted-foreground">
                                {option.subtitle}
                              </span>
                            ) : null}
                          </div>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleParticipant("pipeliner", option.id)}
                            className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            disabled={creating}
                          />
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Members
                </h4>
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {memberOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No members found.</p>
                  ) : (
                    memberOptions.map((option) => {
                      const checked = form.selectedMemberIds.has(option.id);
                      return (
                        <label
                          key={option.id}
                          className={cn(
                            "flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm transition",
                            checked
                              ? "border-sky-300 bg-sky-50/80 text-sky-800 shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          )}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{option.label}</span>
                            {option.subtitle ? (
                              <span className="text-xs text-muted-foreground">
                                {option.subtitle}
                              </span>
                            ) : null}
                          </div>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleParticipant("member", option.id)}
                            className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            disabled={creating}
                          />
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Selecting pipeliners will automatically update their charity event counts and re-run eligibility checks.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={creating}>
            {creating ? (
              <Loader2Icon className="mr-2 size-4 animate-spin" />
            ) : (
              <HeartHandshakeIcon className="mr-2 size-4" />
            )}
            Save Charity Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


