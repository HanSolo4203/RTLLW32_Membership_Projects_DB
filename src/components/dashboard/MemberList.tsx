"use client";

import Link from "next/link";
import { Mail } from "lucide-react";

import { type MemberPerformance } from "@/hooks/useDashboardStats";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type MemberListProps = {
  title: string;
  subtitle?: string;
  members?: MemberPerformance[];
  totalCount?: number;
  footerHref: string;
  positive?: boolean;
  isLoading: boolean;
  badges?: Array<{ label: string; tone: "danger" | "warning" | "success" }>;
};

const toneClasses: Record<
  "danger" | "warning" | "success",
  { bg: string; text: string }
> = {
  danger: { bg: "bg-red-100 text-red-700", text: "text-red-600" },
  warning: { bg: "bg-amber-100 text-amber-700", text: "text-amber-600" },
  success: { bg: "bg-emerald-100 text-emerald-700", text: "text-emerald-600" },
};

function MemberRow({
  member,
  positive,
}: {
  member: MemberPerformance;
  positive?: boolean;
}) {
  const initials = member.fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const valueClass = positive ? "text-emerald-600" : "text-red-600";

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2 transition hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-900/60">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
          {initials}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {member.fullName}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{member.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-semibold ${valueClass}`}>
          {member.attendancePercentage.toFixed(1)}%
        </span>
        {!positive && member.email && (
          <Button asChild size="sm" variant="outline" className="h-8 gap-1 text-xs">
            <Link href={`mailto:${member.email}`}>
              <Mail className="size-3.5" />
              Contact
            </Link>
          </Button>
        )}
      </div>
    </li>
  );
}

function MemberSkeleton() {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-32 rounded-full" />
          <Skeleton className="h-3 w-20 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-4 w-12 rounded-full" />
    </li>
  );
}

export function MemberList({
  title,
  subtitle,
  members,
  totalCount = 0,
  footerHref,
  positive,
  isLoading,
  badges = [],
}: MemberListProps) {
  return (
    <Card className="h-full border-none bg-white shadow-lg shadow-slate-200/70 transition hover:shadow-xl dark:bg-slate-900">
      <CardHeader className="space-y-3 border-b border-slate-100/70 bg-slate-50/70 px-5 py-4 dark:border-slate-800/70 dark:bg-slate-900/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </CardTitle>
            {subtitle && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
          <Badge variant="secondary" className="rounded-full bg-slate-100 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {totalCount} total
          </Badge>
        </div>
        {badges.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {badges.map((badge) => (
              <span
                key={badge.label}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClasses[badge.tone].bg}`}
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="px-5 py-4">
        {isLoading ? (
          <ul className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, idx) => (
              <MemberSkeleton key={idx} />
            ))}
          </ul>
        ) : members && members.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {members.map((member) => (
              <MemberRow key={member.id} member={member} positive={positive} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No members to display right now.
          </p>
        )}
      </CardContent>
      <CardFooter className="border-t border-slate-100/70 bg-slate-50/70 px-5 py-3 text-sm dark:border-slate-800/70 dark:bg-slate-900/40">
        <Link
          href={footerHref}
          className="flex items-center gap-2 font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          View all ({totalCount})
        </Link>
      </CardFooter>
    </Card>
  );
}

export default MemberList;


