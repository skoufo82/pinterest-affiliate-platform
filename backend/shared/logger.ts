// Structured logging utility for Lambda functions

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogContext {
  requestId?: string;
  userId?: string;
  functionName?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = {
      functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
      ...context,
    };
  }

  private log(level: LogLevel, message: string, additionalContext?: Record<string, unknown>, error?: Error) {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...this.context,
        ...additionalContext,
      },
    };

    if (error) {
      logEntry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as Error & { code?: string }).code,
      };
    }

    // Output as JSON for CloudWatch Logs Insights
    console.log(JSON.stringify(logEntry));
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>) {
    this.log(LogLevel.ERROR, message, context, error);
  }

  // Log request details
  logRequest(event: { 
    httpMethod?: string; 
    path?: string; 
    queryStringParameters?: Record<string, string | undefined> | null; 
    headers?: Record<string, string | undefined> | null;
  }) {
    this.info('Incoming request', {
      httpMethod: event.httpMethod,
      path: event.path,
      queryStringParameters: event.queryStringParameters,
      headers: {
        // Only log non-sensitive headers
        'user-agent': event.headers?.['user-agent'],
        'content-type': event.headers?.['content-type'],
      },
    });
  }

  // Log response details
  logResponse(statusCode: number, duration?: number) {
    this.info('Outgoing response', {
      statusCode,
      duration: duration ? `${duration}ms` : undefined,
    });
  }

  // Create a child logger with additional context
  child(additionalContext: LogContext): Logger {
    return new Logger({
      ...this.context,
      ...additionalContext,
    });
  }
}

// Factory function to create a logger with request context
export function createLogger(requestId?: string, additionalContext?: LogContext): Logger {
  return new Logger({
    requestId,
    ...additionalContext,
  });
}

export default Logger;
