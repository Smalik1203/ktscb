import * as Sentry from '@sentry/react-native';

const isDev = __DEV__;

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

class Logger {
  private level: LogLevel;
  private showTimestamps: boolean;

  constructor() {
    this.showTimestamps = false;
    this.level = isDev ? LogLevel.INFO : LogLevel.ERROR;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    if (this.showTimestamps) {
      return `[${new Date().toISOString()}] ${level}: ${message}`;
    }
    return `${level}: ${message}`;
  }

  error(messageOrError: string | Error, ...args: any[]): void {
    if (isDev && this.shouldLog(LogLevel.ERROR)) {
      console.error(
        typeof messageOrError === 'string'
          ? this.formatMessage('ERROR', messageOrError)
          : messageOrError,
        ...args
      );
    }
    try {
      const err =
        typeof messageOrError === 'object' && messageOrError instanceof Error
          ? messageOrError
          : args.find((a): a is Error => a instanceof Error) ?? null;
      if (err) {
        Sentry.captureException(err, {
          extra:
            typeof messageOrError === 'string'
              ? { message: messageOrError, args }
              : { args },
        });
      } else {
        const msg =
          typeof messageOrError === 'string' ? messageOrError : 'Unknown error';
        Sentry.captureMessage(msg, {
          level: 'error',
          extra: args.length ? { args } : undefined,
        });
      }
    } catch {}
  }

  warn(message: string, ...args: any[]): void {
    if (isDev && this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message), ...args);
    }
    try {
      Sentry.addBreadcrumb({
        category: 'log',
        level: 'warning',
        message,
        data: args.length ? { args } : undefined,
      });
    } catch {}
  }

  info(message: string, ...args: any[]): void {
    if (isDev && this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage('INFO', message), ...args);
    }
    try {
      Sentry.addBreadcrumb({
        category: 'log',
        level: 'info',
        message,
        data: args.length ? { args } : undefined,
      });
    } catch {}
  }

  debug(message: string, ...args: any[]): void {
    if (isDev && this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage('DEBUG', message), ...args);
    }
  }

  auth(message: string, ...args: any[]): void {
    if (isDev) console.log(`🔐 ${message}`, ...args);
  }

  api(message: string, ...args: any[]): void {
    if (isDev) console.log(`🌐 ${message}`, ...args);
  }

  storage(message: string, ...args: any[]): void {
    if (isDev) console.log(`💾 ${message}`, ...args);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setDevelopmentMode(enabled: boolean): void {
    if (!enabled) this.level = LogLevel.ERROR;
  }

  setTimestamps(enabled: boolean): void {
    this.showTimestamps = enabled;
  }
}

export const logger = new Logger();
export const log = {
  error: logger.error.bind(logger),
  warn: logger.warn.bind(logger),
  info: logger.info.bind(logger),
  debug: logger.debug.bind(logger),
  auth: logger.auth.bind(logger),
  api: logger.api.bind(logger),
  storage: logger.storage.bind(logger),
};
