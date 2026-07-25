// src/lib/error-reporting.ts
import * as Sentry from "@sentry/nextjs";

type ErrorContext = {
  route: string;
  sessionId?: string;
  caseBriefId?: string;
  userId?: string;
  extra?: Record<string, unknown>;
};

export function reportError(error: unknown, context: ErrorContext) {
  console.error(`[${context.route}]`, error); // Still prints to terminal!

  Sentry.captureException(error, {
    tags: { route: context.route },
    extra: {
      sessionId: context.sessionId,
      caseBriefId: context.caseBriefId,
      userId: context.userId,
      ...context.extra,
    },
  });
}