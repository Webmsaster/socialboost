/**
 * Captures an error to console. Add Sentry later for production monitoring.
 */
export function captureError(
  message: string,
  error?: unknown,
  context?: Record<string, unknown>
) {
  console.error(message, error ?? "", context ?? "");
}
