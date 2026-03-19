// server.js — VeridCall Backend Entry Point
//
// Stack: Node.js + Express + Socket.io + Prisma (PostgreSQL)
//
// Start:   node server.js
// Dev:     nodemon server.js
// Env:     copy .env.example → .env and fill in values
// DB:      npx prisma migrate dev --name init

require("dotenv").config();

const express      = require("express");
const http         = require("http");
const { Server }   = require("socket.io");
const cors         = require("cors");
const helmet       = require("helmet");
const cookieParser = require("cookie-parser");
const morgan       = require("morgan");
const rateLimit    = require("express-rate-limit");

const logger              = require("./src/config/logger");
const { attachSignaling } = require("./src/signaling/socketHandler");

// ─── Routes ───────────────────────────────────────────────────────────────────
const authRoutes          = require("./src/routes/auth");
const roomsRoutes         = require("./src/routes/rooms");
const recordingsRoutes    = require("./src/routes/recordings");
const iceServersRouter    = require("./src/services/turnService");
const livekitRouter       = require("./src/routes/livekit");

// ─── App Setup ────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin:      process.env.CLIENT_URL || "http://localhost:3000",
    methods:     ["GET", "POST"],
    credentials: true,
  },
  // Use WebSocket transport first, fall back to long-polling
  transports:  ["websocket", "polling"],
  // Ping every 25s, disconnect after missing 2 pings (keeps connections clean)
  pingInterval: 25000,
  pingTimeout:  60000,
});

attachSignaling(io);

// ─── Express Middleware ───────────────────────────────────────────────────────

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // Relax CSP in dev, tighten in production
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
  })
);

// CORS — allow only the frontend origin
app.use(
  cors({
    origin:      process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true, // allow cookies cross-origin
    methods:     ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// JSON + URL-encoded body parsing for all other routes
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

// Request logging (skip in test)
if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

// Strict limit on auth routes to prevent brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max:      20,               // 20 attempts per window
  message:  { error: "Too many requests. Try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders:   false,
});

// General API limit
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max:      120,        // 120 req/min per IP
  message:  { error: "Rate limit exceeded." },
  standardHeaders: true,
  legacyHeaders:   false,
});

app.use("/api/auth", authLimiter);
app.use("/api",      apiLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth",           authRoutes);
app.use("/api/rooms",          roomsRoutes);
app.use("/api/recordings",     recordingsRoutes);
app.use("/api/subscriptions",  require("./src/routes/subscriptions"));
app.use("/api/adapty",          require("./src/routes/subscriptions"));  // webhook alias
app.use("/api/ice-servers",    iceServersRouter);
app.use("/api/livekit",         livekitRouter);
// AI co-pilot + summaries + geo analytics
const aiRouter = require("./src/routes/ai");
app.use("/api/ai",             aiRouter);
app.use("/api/analytics",      aiRouter);   // shares same router (geo endpoints)

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status:    "ok",
    timestamp: new Date().toISOString(),
    uptime:    process.uptime(),
    version:   process.env.npm_package_version || "1.0.0",
  });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error("Unhandled error", {
    error:   err.message,
    stack:   process.env.NODE_ENV === "development" ? err.stack : undefined,
    method:  req.method,
    path:    req.path,
  });

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "production"
      ? "An unexpected error occurred."
      : err.message,
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 4000;

server.listen(PORT, () => {
  logger.info(`VeridCall backend running`, {
    port:    PORT,
    env:     process.env.NODE_ENV || "development",
    pid:     process.pid,
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);

  server.close(async () => {
    const { default: prisma } = await import("./src/config/db.js").catch(() => ({ default: null }));
    if (prisma) await prisma.$disconnect();
    logger.info("Server closed.");
    process.exit(0);
  });

  // Force exit after 10s if still alive
  setTimeout(() => {
    logger.warn("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));

module.exports = { app, server, io };
