"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
    if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import("@sentry/nextjs")
        .then((Sentry) => {
          Sentry.captureException(error, {
            extra: { componentStack: errorInfo.componentStack },
          });
        })
        .catch(() => {});
    }
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: undefined,
      retryCount: prev.retryCount + 1,
    }));
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const maxRetries = this.state.retryCount >= 2;

      return (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-xl border bg-background p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold">Something went wrong</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          {maxRetries ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                This error persists after retrying. Try reloading the page.
              </p>
              <Button onClick={this.handleReload} variant="default">
                Reload Page
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button onClick={this.handleRetry} variant="outline">
                Try Again
              </Button>
              <Button onClick={this.handleReload} variant="ghost">
                Reload Page
              </Button>
            </div>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
