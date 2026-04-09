/**
 * Captures errors. When NEXT_PUBLIC_SENTRY_DSN is set, forwards to Sentry
 * via dynamic import (so Sentry is code-split into its own chunk and only
 * loaded when actually needed). Otherwise logs to console only.
 */

// Minimal structural type — only the two Sentry functions we call
interface SentryLike {
  captureException(error: Error, hint?: { extra?: Record<string, unknown> }): void;
  captureMessage(
    message: string,
    hint?: { level?: string; extra?: Record<string, unknown> }
  ): void;
}

// Test-only override for the Sentry module used by captureError
let _sentryOverride: SentryLike | undefined;

/** @internal Test-only: override the Sentry module used by captureError */
export function _setSentry(mod: SentryLike | undefined) {
  _sentryOverride = mod;
}

function forwardToSentry(
  sentry: SentryLike,
  message: string,
  error: unknown,
  context?: Record<string, unknown>,
) {
  try {
    if (error instanceof Error) {
      sentry.captureException(error, { extra: { ...context, message } });
    } else {
      sentry.captureMessage(message, {
        level: "error",
        extra: { ...context, originalError: String(error) },
      });
    }
  } catch {
    // Swallow Sentry errors — console.error above is sufficient
  }
}

export function captureError(
  message: string,
  error?: unknown,
  context?: Record<string, unknown>,
) {
  console.error(message, error ?? "", context ?? "");

  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  if (_sentryOverride) {
    forwardToSentry(_sentryOverride, message, error, context);
    return;
  }

  // Dynamic import keeps Sentry in its own chunk — only downloaded
  // when captureError is called AND DSN is configured.
  import("@sentry/nextjs")
    .then((mod) => forwardToSentry(mod as unknown as SentryLike, message, error, context))
    .catch(() => {
      // Sentry not installed — console.error above is sufficient
    });
}
