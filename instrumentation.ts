import type { Instrumentation } from "next";

/**
 * Error tracking hook (Phase C). Off unless ERROR_TRACKING=vercel. When on, every server error is
 * written as one JSON line to the Vercel runtime logs, where a log drain can forward it (for
 * example to Sentry). No error text with user data leaves the platform from here.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.ERROR_TRACKING !== "vercel") return;
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest)
      : undefined;
  console.error(
    JSON.stringify({
      event: "request_error",
      name: error instanceof Error ? error.name : "UnknownError",
      digest,
      method: request.method,
      path: request.path.split("?")[0],
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: "renderSource" in context ? context.renderSource : undefined,
    }),
  );
};
