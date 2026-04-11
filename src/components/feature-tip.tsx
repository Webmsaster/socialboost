"use client";

import { useState, useSyncExternalStore } from "react";

interface FeatureTipProps {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

/**
 * Wraps a UI element with a one-time tooltip that highlights a new feature.
 * Shown once per user (tracked via localStorage). Dismissed on click.
 */
export function FeatureTip({ id, title, description, children }: FeatureTipProps) {
  const [dismissed, setDismissed] = useState(false);
  const storageKey = `feature-tip-${id}`;

  const wasSeen = useSyncExternalStore(
    (cb) => { window.addEventListener("storage", cb); return () => window.removeEventListener("storage", cb); },
    () => { try { return localStorage.getItem(storageKey) === "1"; } catch { return true; } },
    () => true,
  );

  const visible = !wasSeen && !dismissed;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative">
      {children}
      {visible && (
        <div
          className="absolute left-0 top-full z-40 mt-2 w-64 rounded-lg border bg-background p-3 shadow-lg animate-in fade-in slide-in-from-top-2"
          role="tooltip"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
            <button
              onClick={dismiss}
              className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss tip"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="absolute -top-1.5 left-4 h-3 w-3 rotate-45 border-l border-t bg-background" />
        </div>
      )}
    </div>
  );
}
