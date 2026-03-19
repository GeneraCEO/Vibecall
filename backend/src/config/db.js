// src/config/db.js
// Singleton Prisma client — reuse across the app, avoid connection pool exhaustion.

const { PrismaClient } = require("@prisma/client");
const logger = require("./logger");

const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? [
          { level: "query", emit: "event" },
          { level: "error", emit: "event" },
          { level: "warn",  emit: "event" },
        ]
      : [{ level: "error", emit: "event" }],
});

// Log slow/problematic queries in development
if (process.env.NODE_ENV === "development") {
  prisma.$on("query", (e) => {
    if (e.duration > 500) {
      logger.warn("Slow DB query", { query: e.query, duration: `${e.duration}ms` });
    }
  });
}

prisma.$on("error", (e) => {
  logger.error("Prisma error", { message: e.message });
});

module.exports = prisma;
