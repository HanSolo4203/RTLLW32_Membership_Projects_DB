import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatsCardProps = {
  title: string;
  icon: ReactNode;
  value: number | null;
  trend?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  fallback?: string;
  backgroundClassName: string;
  renderValue?: (value: number) => ReactNode;
};

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function AnimatedCounter({
  value,
  renderValue,
  duration = 900,
}: {
  value: number;
  renderValue: (value: number) => ReactNode;
  duration?: number;
}) {
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    const startValue = previousValue.current;
    const delta = value - startValue;
    if (delta === 0) {
      return;
    }

    previousValue.current = value;
    startRef.current = null;

    const step = (timestamp: number) => {
      if (startRef.current === null) {
        startRef.current = timestamp;
      }
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);
      const nextValue = startValue + delta * easedProgress;
      setDisplayValue(nextValue);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value, duration]);

  return <>{renderValue(displayValue)}</>;
}

export function StatsCard({
  title,
  icon,
  value,
  trend,
  prefix,
  suffix,
  decimals = 0,
  fallback = "—",
  backgroundClassName,
  renderValue,
}: StatsCardProps) {
  const render = useMemo(
    () =>
      renderValue ??
      ((current: number) => {
        const formatted = current.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
        return (
          <span>
            {prefix}
            {formatted}
            {suffix}
          </span>
        );
      }),
    [renderValue, decimals, prefix, suffix]
  );

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-none text-white shadow-lg shadow-black/10 transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl",
        "bg-gradient-to-br",
        backgroundClassName
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.15),transparent_60%)]" />
      <CardHeader className="relative z-10 flex flex-row items-start justify-between gap-4 p-6">
        <div>
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-white/80">
            {title}
          </CardTitle>
          <p className="mt-3 text-3xl font-bold leading-tight">
            {value !== null ? (
              <AnimatedCounter value={value} renderValue={render} />
            ) : (
              fallback
            )}
          </p>
        </div>
        <div className="flex size-12 items-center justify-center rounded-full bg-white/15 text-white">
          {icon}
        </div>
      </CardHeader>
      {trend && (
        <CardContent className="relative z-10 pt-0 pb-6">
          <p className="text-sm font-medium text-white/80">{trend}</p>
        </CardContent>
      )}
    </Card>
  );
}

export default StatsCard;

