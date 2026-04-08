"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const shortcuts: { key: string; label: string; href: string }[] = [
  { key: "d", label: "Dashboard", href: "/dashboard" },
  { key: "n", label: "New Post", href: "/create" },
  { key: "b", label: "Bulk Generate", href: "/bulk" },
  { key: "t", label: "Templates", href: "/templates" },
  { key: "h", label: "History", href: "/history" },
  { key: "c", label: "Calendar", href: "/calendar" },
  { key: "a", label: "Analytics", href: "/analytics" },
  { key: "s", label: "Settings", href: "/settings" },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (target instanceof HTMLElement) {
        if (
          target.isContentEditable ||
          target.getAttribute("role") === "combobox" ||
          target.closest('[contenteditable="true"]')
        ) {
          return;
        }
      }

      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      if (e.key === "Escape") {
        setOpen(false);
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const match = shortcuts.find((s) => s.key === e.key.toLowerCase());
      if (match) {
        e.preventDefault();
        router.push(match.href);
      }
    },
    [router]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{s.label}</span>
              <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">
                {s.key.toUpperCase()}
              </kbd>
            </div>
          ))}
          <div className="border-t pt-2 mt-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Toggle this panel</span>
              <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">?</kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
