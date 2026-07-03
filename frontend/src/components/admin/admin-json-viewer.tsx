"use client";

import { useState } from "react";

export function AdminJsonViewer({ data, label = "JSON" }: { data: unknown; label?: string }) {
  const [open, setOpen] = useState(false);
  const text = JSON.stringify(data, null, 2);

  return (
    <div className="rounded-lg border border-border/15 bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hover:bg-muted/50"
      >
        <span>{label}</span>
        <span>{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <pre className="max-h-96 overflow-auto border-t border-border/15 p-3 font-mono text-xs leading-relaxed text-foreground/90">
          {text}
        </pre>
      )}
    </div>
  );
}
