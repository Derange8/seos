import type { Logger, LogContext } from "@/shared/logger";

export class ConsoleLogger implements Logger {
  debug(message: string, context?: LogContext): void {
    console.debug(message, context ?? "");
  }

  info(message: string, context?: LogContext): void {
    console.info(message, context ?? "");
  }

  warn(message: string, context?: LogContext): void {
    console.warn(message, context ?? "");
  }

  error(message: string, context?: LogContext): void {
    console.error(message, context ?? "");
  }
}
