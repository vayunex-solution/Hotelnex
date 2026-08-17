import configService from '../config/configService.js';

class Logger {
  constructor() {
    this.logLevel = configService.get('LOG_LEVEL', 'info').toLowerCase();
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
  }

  shouldLog(level) {
    const currentPriority = this.levels[this.logLevel] ?? 1;
    const targetPriority = this.levels[level] ?? 1;
    return targetPriority >= currentPriority;
  }

  formatMessage(level, message, meta) {
    const timestamp = new Date().toISOString();
    let formatted = `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
    if (meta && Object.keys(meta).length > 0) {
      formatted += ` | Meta: ${JSON.stringify(meta)}`;
    }
    return formatted;
  }

  debug(message, meta = {}) {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  info(message, meta = {}) {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, meta));
    }
  }

  warn(message, meta = {}) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  error(message, errorOrMeta = {}) {
    if (this.shouldLog('error')) {
      let meta = {};
      if (errorOrMeta instanceof Error) {
        meta = {
          name: errorOrMeta.name,
          message: errorOrMeta.message,
          stack: errorOrMeta.stack
        };
      } else {
        meta = errorOrMeta;
      }
      console.error(this.formatMessage('error', message, meta));
    }
  }
}

const logger = new Logger();
export default logger;
