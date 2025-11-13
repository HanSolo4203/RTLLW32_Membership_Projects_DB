"use client";

import Link from "next/link";
import {
  AlertOctagon,
  ArrowRight,
  PartyPopper,
  ShieldAlert,
} from "lucide-react";

import { type DashboardAlert } from "@/hooks/useDashboardStats";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type ActionAlertsProps = {
  alerts?: DashboardAlert[];
};

const toneIconMap: Record<
  DashboardAlert["tone"],
  { icon: typeof AlertOctagon; color: string }
> = {
  danger: { icon: AlertOctagon, color: "text-red-500" },
  warning: { icon: ShieldAlert, color: "text-amber-500" },
  success: { icon: PartyPopper, color: "text-emerald-500" },
};

export function ActionAlerts({ alerts }: ActionAlertsProps) {
  const items = alerts ?? [];
  const visibleAlerts = items.slice(0, 3);
  const hasMore = items.length > visibleAlerts.length;

  if (visibleAlerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {visibleAlerts.map((alert) => {
        const tone = toneIconMap[alert.tone];
        const Icon = tone.icon;

        return (
          <Alert
            key={alert.id}
            variant={
              alert.tone === "danger"
                ? "destructive"
                : alert.tone === "warning"
                  ? "warning"
                  : "success"
            }
            className="flex flex-col gap-3 border-none bg-white shadow-md shadow-slate-200/70 transition hover:shadow-lg dark:bg-slate-900"
          >
            <div className="flex items-start gap-3">
              <Icon className={`mt-0.5 size-5 ${tone.color}`} />
              <div className="flex-1 space-y-1">
                <AlertTitle className="text-base font-semibold leading-tight">
                  {alert.title}
                </AlertTitle>
                <AlertDescription className="text-sm text-slate-600 dark:text-slate-300">
                  {alert.message}
                </AlertDescription>
              </div>
            </div>
            {alert.actions && alert.actions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pl-8">
                {alert.actions.map((action) => (
                  <Button
                    key={`${alert.id}-${action.label}`}
                    variant="outline"
                    size="sm"
                    className="h-9 gap-2 rounded-full"
                    asChild
                  >
                    <Link href={action.href}>
                      {action.label}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                ))}
              </div>
            )}
          </Alert>
        );
      })}
      {hasMore && (
        <Link
          href="/reports"
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Show more alerts
          <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

export default ActionAlerts;


