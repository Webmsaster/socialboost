import * as Sentry from "@sentry/nextjs";

// Next.js 16 only loads the server/edge Sentry configs through the
// instrumentation hook — without this file sentry.server.config.ts and
// sentry.edge.config.ts are dead, so uncaught server / RSC / edge errors never
// reach Sentry via auto-capture (only explicit captureError calls do).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Captures errors thrown in Server Components, middleware (proxy.ts), and route
// handlers that Next.js surfaces through the onRequestError hook.
export const onRequestError = Sentry.captureRequestError;
