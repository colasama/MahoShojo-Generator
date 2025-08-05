import pino from 'pino';

// 创建 Pino 日志器配置
const createLogger = () => {
  const isDev = process.env.NODE_ENV === 'development';
  const isEdge = process.env.NEXT_RUNTIME === 'edge';

  // Edge Runtime 环境配置
  if (isEdge) {
    return pino({
      level: isDev ? 'debug' : 'info',
      browser: {
        write: (o: any) => {
          console.log(JSON.stringify(o));
        }
      }
    });
  }

  // Node.js 环境配置
  return pino({
    level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
    transport: isDev ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'HH:MM:ss',
        messageFormat: '[{caller}] {msg}',
        singleLine: false
      }
    } : undefined,
    formatters: {
      level: (label: string) => {
        return { level: label };
      }
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
};

// 创建日志器实例
const logger = createLogger();

// 创建带有文件名的日志实例
export const getLogger = (fileName: string) => ({
  info: (msg: string, ...args: any[]) => {
    if (args.length > 0) {
      // 如果有额外参数，将它们合并到对象中
      const [firstArg, ...restArgs] = args;
      if (typeof firstArg === 'object' && firstArg !== null) {
        logger.info({ caller: fileName, ...firstArg }, msg, ...restArgs);
      } else {
        logger.info({ caller: fileName, data: firstArg }, msg, ...restArgs);
      }
    } else {
      logger.info({ caller: fileName }, msg);
    }
  },
  error: (msg: string, ...args: any[]) => {
    if (args.length > 0) {
      const [firstArg, ...restArgs] = args;
      if (typeof firstArg === 'object' && firstArg !== null) {
        logger.error({ caller: fileName, ...firstArg }, msg, ...restArgs);
      } else {
        logger.error({ caller: fileName, data: firstArg }, msg, ...restArgs);
      }
    } else {
      logger.error({ caller: fileName }, msg);
    }
  },
  warn: (msg: string, ...args: any[]) => {
    if (args.length > 0) {
      const [firstArg, ...restArgs] = args;
      if (typeof firstArg === 'object' && firstArg !== null) {
        logger.warn({ caller: fileName, ...firstArg }, msg, ...restArgs);
      } else {
        logger.warn({ caller: fileName, data: firstArg }, msg, ...restArgs);
      }
    } else {
      logger.warn({ caller: fileName }, msg);
    }
  },
  debug: (msg: string, ...args: any[]) => {
    if (args.length > 0) {
      const [firstArg, ...restArgs] = args;
      if (typeof firstArg === 'object' && firstArg !== null) {
        logger.debug({ caller: fileName, ...firstArg }, msg, ...restArgs);
      } else {
        logger.debug({ caller: fileName, data: firstArg }, msg, ...restArgs);
      }
    } else {
      logger.debug({ caller: fileName }, msg);
    }
  }
});

// 默认日志方法（无文件名）
export const log = {
  info: (msg: string, ...args: any[]) => {
    logger.info(msg, ...args);
  },
  error: (msg: string, ...args: any[]) => {
    logger.error(msg, ...args);
  },
  warn: (msg: string, ...args: any[]) => {
    logger.warn(msg, ...args);
  },
  debug: (msg: string, ...args: any[]) => {
    logger.debug(msg, ...args);
  }
};