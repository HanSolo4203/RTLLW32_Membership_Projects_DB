"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ClipboardList,
  PlusCircle,
  Sparkles,
  UserPlus,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ActionItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

const actions: ActionItem[] = [
  {
    label: "Record Attendance",
    href: "/attendance",
    icon: <ClipboardList className="size-4" />,
  },
  {
    label: "Add Member",
    href: "/members",
    icon: <PlusCircle className="size-4" />,
  },
  {
    label: "Add Guest",
    href: "/guests",
    icon: <UserPlus className="size-4" />,
  },
  {
    label: "Reports",
    href: "/reports",
    icon: <Sparkles className="size-4" />,
  },
];

export function QuickActions() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        open &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50">
      <Button
        className={cn(
          "size-14 rounded-full bg-blue-600 text-white shadow-xl shadow-blue-500/30 transition hover:scale-105 hover:bg-blue-500 focus-visible:ring-blue-300",
          open && "rotate-12"
        )}
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-label="Quick actions"
      >
        <Zap className="size-6" />
      </Button>
      <div
        className={cn(
          "pointer-events-none absolute bottom-16 right-0 flex w-56 origin-bottom-right scale-95 flex-col gap-2 rounded-2xl bg-white p-3 opacity-0 shadow-2xl shadow-slate-900/10 ring-1 ring-slate-100 transition-all duration-200 ease-out dark:bg-slate-900 dark:shadow-slate-900/30 dark:ring-slate-700",
          open && "pointer-events-auto translate-y-[-8px] scale-100 opacity-100"
        )}
      >
        {actions.map((action) => (
          <Button
            key={action.label}
            asChild
            variant="ghost"
            className="justify-start gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600 dark:text-slate-200 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
            onClick={() => setOpen(false)}
          >
            <Link href={action.href}>
              {action.icon}
              {action.label}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}

export default QuickActions;


