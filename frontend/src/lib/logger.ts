type LogContext = Record<string, unknown>;

function formatMessage(level: string, message: string, context?: LogContext): string {
  const ctx = context ? ` ${JSON.stringify(context)}` : "";
  return `[daxch] ${level}: ${message}${ctx}`;
}

export const logger = {
  info(message: string, context?: LogContext): void {
    console.info(formatMessage("info", message, context));
  },
  warn(message: string, context?: LogContext): void {
    console.warn(formatMessage("warn", message, context));
  },
  error(message: string, context?: LogContext): void {
    console.error(formatMessage("error", message, context));
  }
};
