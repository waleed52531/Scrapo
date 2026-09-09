import { Logger } from "@nestjs/common";
import { redactSensitive } from "./redact";

const logger = new Logger("ErrorTracking");

export function captureException(
  exception: unknown,
  context: Record<string, unknown>,
) {
  if (!process.env.SENTRY_DSN) return;

  logger.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "api",
      event: "error_tracking.capture_pending_provider",
      exception:
        exception instanceof Error
          ? { name: exception.name, message: exception.message }
          : { message: "Unknown exception" },
      context: redactSensitive(context),
    }),
  );
}
