import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

type InfoHintProps = {
  label: string;
  className?: string;
};

export function InfoHint({ label, className }: InfoHintProps) {
  return (
    <span className={cn("group relative inline-flex items-center", className)}>
      <button
        aria-label={label}
        className="inline-flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        type="button"
      >
        <Info className="size-3.5" aria-hidden="true" />
      </button>
      <span className="pointer-events-none absolute right-0 top-8 z-20 hidden w-64 rounded-md border bg-popover px-3 py-2 text-xs font-normal leading-5 text-popover-foreground shadow-lg group-hover:block group-focus-within:block">
        {label}
      </span>
    </span>
  );
}
