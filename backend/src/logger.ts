import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'claude-code-web-ui' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
      format: winston.format.json()
    }),
    new winston.transports.File({
      filename: 'combined.log',
      format: winston.format.json()
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.debug('Logging initialized at debug level');
}