"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

type InfoHintProps = {
  label: string;
  className?: string;
};

export function InfoHint({ label, className }: InfoHintProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function handleCloseOther(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      if (detail !== id) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("sprof-info-hint-open", handleCloseOther);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("sprof-info-hint-open", handleCloseOther);
    };
  }, [id, open]);

  return (
    <span className={cn("relative inline-flex items-center", className)} ref={rootRef}>
      <button
        aria-label={label}
        aria-expanded={open}
        className="inline-flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) {
            window.dispatchEvent(new CustomEvent("sprof-info-hint-open", { detail: id }));
          }
        }}
        type="button"
      >
        <Info className="size-3.5" aria-hidden="true" />
      </button>
      {open ? (
        <span className="pointer-events-none absolute right-0 top-8 z-20 w-64 rounded-md border bg-popover px-3 py-2 text-xs font-normal leading-5 text-popover-foreground shadow-lg">
          {label}
        </span>
      ) : null}
    </span>
  );
}
