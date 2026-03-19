// src/config/logger.js
const winston = require("winston");

const { combine, timestamp, colorize, printf, json } = winston.format;

const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  const extras = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : "";
  return `${timestamp} [${level}]: ${message} ${extras}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format:
    process.env.NODE_ENV === "production"
      ? combine(timestamp(), json())
      : combine(
          colorize(),
          timestamp({ format: "HH:mm:ss" }),
          devFormat
        ),
  transports: [
    new winston.transports.Console(),
    // Add file transports in production:
    // new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

module.exports = logger;
