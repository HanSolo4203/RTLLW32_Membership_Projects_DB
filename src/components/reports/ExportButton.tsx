"use client";

import { DownloadIcon, Loader2Icon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";

type ExportButtonProps = {
  label: string;
  description: string;
  onExport: () => Promise<void> | void;
  icon?: React.ComponentType<{ className?: string }>;
};

export function ExportButton({ label, description, onExport, icon: Icon }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (loading) return;
    try {
      setLoading(true);
      await onExport();
    } finally {
      setLoading(false);
    }
  }, [loading, onExport]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-slate-900/5 text-slate-900">
          {Icon ? <Icon className="size-5" /> : <DownloadIcon className="size-5" />}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button onClick={handleClick} disabled={loading} className="w-full gap-2">
        {loading ? (
          <>
            <Loader2Icon className="size-4 animate-spin" />
            Preparing...
          </>
        ) : (
          <>
            <DownloadIcon className="size-4" />
            Download
          </>
        )}
      </Button>
    </div>
  );
}


