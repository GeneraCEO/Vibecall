// src/routes/rooms.js
// Room management: create, list, get, join (validate), end.
// WebRTC signaling is handled separately via Socket.io (see signaling/socketHandler.js).

const router = require("express").Router();
const bcrypt = require("bcryptjs");
const { body, param, validationResult } = require("express-validator");

const prisma  = require("../config/db");
const logger  = require("../config/logger");
const { authenticate, requireTier } = require("../middleware/auth");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a human-readable room code like "ABC-1234".
 * Excludes ambiguous chars (0, O, I, 1, L).
 */
function generateRoomCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = () => chars[Math.floor(Math.random() * chars.length)];
  return `${pick()}${pick()}${pick()}-${pick()}${pick()}${pick()}${pick()}`;
}

/** Max participants allowed per subscription tier */
const MAX_PARTICIPANTS = {
  FREE:       10,
  STARTER:    50,
  PRO:        100,
  BUSINESS:   300,
  ENTERPRISE: 1000,
};

/** Meeting duration limits (minutes) — 0 = unlimited */
const MAX_DURATION = {
  FREE:       60,
  STARTER:    300,  // 5 hours
  PRO:        0,    // unlimited
  BUSINESS:   0,
  ENTERPRISE: 0,
};

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/rooms — create a new room
router.post(
  "/",
  authenticate,
  [
    body("name").trim().isLength({ min: 1, max: 120 }).withMessage("Room name required (max 120 chars)"),
    body("password").optional().isLength({ min: 4 }).withMessage("Password must be at least 4 characters"),
    body("waitingRoom").optional().isBoolean(),
    body("allowScreenShare").optional().isBoolean(),
    body("allowRecording").optional().isBoolean(),
    body("allowChat").optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      name,
      password,
      waitingRoom     = false,
      allowScreenShare = true,
      allowRecording  = true,
      allowChat       = true,
    } = req.body;

    const tier           = req.user.subscriptionTier;
    const maxParticipants = MAX_PARTICIPANTS[tier] ?? 10;

    try {
      // Generate a unique code (retry up to 5 times if collision)
      let code;
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateRoomCode();
        const exists    = await prisma.room.findUnique({ where: { code: candidate } });
        if (!exists) { code = candidate; break; }
      }
      if (!code) return res.status(500).json({ error: "Could not generate room code." });

      const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

      const room = await prisma.room.create({
        data: {
          name,
          code,
          hostId:         req.user.id,
          password:       hashedPassword,
          waitingRoom,
          maxParticipants,
          allowScreenShare,
          allowRecording,
          allowChat,
          isActive:       true,
          startedAt:      new Date(),
        },
        select: {
          id: true, name: true, code: true, hostId: true,
          encrypted: true, waitingRoom: true, maxParticipants: true,
          allowScreenShare: true, allowRecording: true, allowChat: true,
          isActive: true, startedAt: true, createdAt: true,
          host: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      logger.info("Room created", { roomId: room.id, code: room.code, hostId: req.user.id });

      return res.status(201).json({ room, maxDurationMinutes: MAX_DURATION[tier] });
    } catch (err) {
      logger.error("Create room error", { error: err.message });
      return res.status(500).json({ error: "Could not create room." });
    }
  }
);

// GET /api/rooms — list rooms hosted by the authenticated user
router.get("/", authenticate, async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      where:   { hostId: req.user.id },
      orderBy: { createdAt: "desc" },
      take:    50,
      select: {
        id: true, name: true, code: true, isActive: true,
        startedAt: true, endedAt: true, createdAt: true, maxParticipants: true,
        _count: { select: { participants: true, recordings: true } },
      },
    });

    return res.json({ rooms });
  } catch (err) {
    logger.error("List rooms error", { error: err.message });
    return res.status(500).json({ error: "Could not fetch rooms." });
  }
});

// GET /api/rooms/:code — get room by code (for the "join" pre-check screen)
router.get(
  "/:code",
  authenticate,
  [param("code").trim().isLength({ min: 3, max: 20 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const room = await prisma.room.findUnique({
        where: { code: req.params.code.toUpperCase() },
        select: {
          id: true, name: true, code: true, hostId: true,
          encrypted: true, waitingRoom: true, isActive: true,
          maxParticipants: true, allowChat: true, allowScreenShare: true, allowRecording: true,
          // Return true/false whether a password is set — never return the hash
          password:  true,
          startedAt: true,
          host: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { participants: true } },
        },
      });

      if (!room) return res.status(404).json({ error: "Room not found." });
      if (!room.isActive) return res.status(410).json({ error: "This meeting has ended." });

      // Replace the password hash with a simple flag
      const { password, ...safeRoom } = room;
      return res.json({ room: { ...safeRoom, hasPassword: Boolean(password) } });
    } catch (err) {
      logger.error("Get room error", { error: err.message });
      return res.status(500).json({ error: "Could not fetch room." });
    }
  }
);

// POST /api/rooms/:code/join — validate password before user joins via socket
router.post(
  "/:code/join",
  authenticate,
  [
    param("code").trim().isLength({ min: 3, max: 20 }),
    body("password").optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const room = await prisma.room.findUnique({
        where: { code: req.params.code.toUpperCase() },
      });

      if (!room)       return res.status(404).json({ error: "Room not found." });
      if (!room.isActive) return res.status(410).json({ error: "This meeting has ended." });

      // Count active participants (those who haven't left)
      const currentCount = await prisma.roomParticipant.count({
        where: { roomId: room.id, leftAt: null },
      });

      if (currentCount >= room.maxParticipants) {
        return res.status(403).json({ error: "Room is full." });
      }

      // Verify password if room is password-protected
      if (room.password) {
        const { password } = req.body;
        if (!password) return res.status(401).json({ error: "Password required." });

        const match = await bcrypt.compare(password, room.password);
        if (!match)   return res.status(401).json({ error: "Incorrect password." });
      }

      // Upsert participant row (handles rejoining)
      await prisma.roomParticipant.upsert({
        where:  { roomId_userId: { roomId: room.id, userId: req.user.id } },
        create: { roomId: room.id, userId: req.user.id },
        update: { joinedAt: new Date(), leftAt: null },
      });

      logger.info("Participant joined room", { roomId: room.id, userId: req.user.id });

      // Return a join token — socket handler will validate this
      const jwt = require("jsonwebtoken");
      const joinToken = jwt.sign(
        { userId: req.user.id, roomId: room.id, name: req.user.name },
        process.env.JWT_SECRET,
        { expiresIn: "2h" }
      );

      return res.json({ joinToken, room: { id: room.id, name: room.name, code: room.code } });
    } catch (err) {
      logger.error("Join room error", { error: err.message });
      return res.status(500).json({ error: "Could not join room." });
    }
  }
);

// POST /api/rooms/:id/end — host ends the room
router.post("/:id/end", authenticate, async (req, res) => {
  try {
    const room = await prisma.room.findUnique({ where: { id: req.params.id } });

    if (!room) return res.status(404).json({ error: "Room not found." });
    if (room.hostId !== req.user.id) {
      return res.status(403).json({ error: "Only the host can end the meeting." });
    }

    await prisma.room.update({
      where: { id: room.id },
      data:  { isActive: false, endedAt: new Date() },
    });

    // Mark all active participants as left
    await prisma.roomParticipant.updateMany({
      where: { roomId: room.id, leftAt: null },
      data:  { leftAt: new Date() },
    });

    logger.info("Room ended", { roomId: room.id, hostId: req.user.id });

    return res.json({ message: "Meeting ended." });
  } catch (err) {
    logger.error("End room error", { error: err.message });
    return res.status(500).json({ error: "Could not end meeting." });
  }
});

module.exports = router;
