/**
 * Centralized Logging Utility
 *
 * Controls all console output based on environment and log level
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'none';

class Logger {
  private logLevel: LogLevel;
  private enabledModules: Set<string>;

  constructor() {
    // Default: only errors in production, all in development
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) ||
      (process.env.NODE_ENV === 'production' ? 'error' : 'info');

    // Modules to enable logging for (empty = all modules)
    const enabledStr = process.env.LOG_MODULES || '';
    this.enabledModules = new Set(enabledStr.split(',').filter(Boolean));
  }

  private shouldLog(level: LogLevel, module?: string): boolean {
    const levels: LogLevel[] = ['none', 'error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);

    if (requestedLevelIndex > currentLevelIndex) {
      return false;
    }

    // If specific modules are enabled, check if this module is in the list
    if (this.enabledModules.size > 0 && module) {
      return this.enabledModules.has(module);
    }

    return true;
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  info(message: string, module?: string, ...args: any[]): void {
    if (this.shouldLog('info', module)) {
      const prefix = module ? `[${module}]` : '';
      console.log(`[INFO] ${prefix} ${message}`, ...args);
    }
  }

  debug(message: string, module?: string, ...args: any[]): void {
    if (this.shouldLog('debug', module)) {
      const prefix = module ? `[${module}]` : '';
      console.log(`[DEBUG] ${prefix} ${message}`, ...args);
    }
  }
}

export default new Logger();
