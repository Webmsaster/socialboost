/**
 * Captures errors. In production with Sentry configured, reports to Sentry.
 * Otherwise logs to console.
 *
 * To enable Sentry:
 * 1. npm install @sentry/nextjs
 * 2. Set NEXT_PUBLIC_SENTRY_DSN env var
 * 3. Run npx @sentry/wizard@latest -i nextjs
 */
export function captureError(
  message: string,
  error?: unknown,
  context?: Record<string, unknown>
) {
  console.error(message, error ?? "", context ?? "");

  // Sentry integration (lazy-loaded to avoid build errors when not installed)
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require("@sentry/nextjs");
      if (error instanceof Error) {
        Sentry.captureException(error, {
          extra: { ...context, message },
        });
      } else {
        Sentry.captureMessage(message, {
          level: "error",
          extra: { ...context, originalError: String(error) },
        });
      }
    } catch {
      // Sentry not installed — console.error above is sufficient
    }
  }
}
