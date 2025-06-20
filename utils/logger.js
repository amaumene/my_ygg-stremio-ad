const winston = require('winston');

const logLevel = process.env.LOG_LEVEL?.toLowerCase();
console.log(`[LOGGER INIT] LOG_LEVEL env = "${process.env.LOG_LEVEL}", using logLevel = "${logLevel}"`);

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

module.exports = logger;