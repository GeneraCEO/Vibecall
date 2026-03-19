/**
 * src/routes/livekit.js
 * ──────────────────────────────────────────────────────────────────────────────
 * All LiveKit-specific REST endpoints
 *
 * POST   /api/livekit/token          → generate participant JWT
 * GET    /api/livekit/ice-servers    → return TURN/STUN config for client
 * GET    /api/livekit/rtc-config     → full RTCConfiguration object
 * POST   /api/livekit/rooms          → create room server-side
 * GET    /api/livekit/rooms          → list active rooms
 * DELETE /api/livekit/rooms/:name    → end a room
 * GET    /api/livekit/rooms/:name/participants → list participants
 * DELETE /api/livekit/rooms/:name/participants/:identity → kick participant
 * POST   /api/livekit/rooms/:name/mute → mute track server-side
 * POST   /api/livekit/recording/start → start cloud recording
 * POST   /api/livekit/recording/stop  → stop cloud recording
 * POST   /api/livekit/webhook         → receive LiveKit events
 * ──────────────────────────────────────────────────────────────────────────────
 */

"use strict";

const express = require("express");
const router  = express.Router();
const {
  generateToken,
  buildIceServers,
  buildRTCConfiguration,
  createRoom,
  listRooms,
  deleteRoom,
  listParticipants,
  removeParticipant,
  muteParticipantTrack,
  startRecording,
  stopRecording,
  verifyWebhook,
} = require("../services/livekitService");

const { requireAuth, requireTier } = require("../middleware/auth");
const logger = require("../config/logger");
const prisma  = require("../config/db");

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/livekit/token
// Generates a short-lived JWT for a participant to join a LiveKit room.
//
// Body:
//   roomCode     {string}  - Your DB room code (e.g. "ABC-1234")
//   participantName {string} - Optional display name override
//   relayOnly    {boolean} - Force TURN relay (for restrictive networks)
//
// Returns:
//   token        {string}  - LiveKit JWT
//   roomName     {string}  - LiveKit room name (same as roomCode)
//   rtcConfig    {object}  - Full RTCConfiguration for the client
// ─────────────────────────────────────────────────────────────────────────────
router.post("/token", requireAuth, async (req, res) => {
  try {
    const { roomCode, participantName, relayOnly = false } = req.body;

    if (!roomCode) {
      return res.status(400).json({ error: "roomCode is required" });
    }

    // BUG FIX: Auto-create room in DB if it doesn't exist.
    // The Dashboard generates room codes (e.g. "ABC-XYZ") client-side without
    // calling the API first. The old code returned 404 for these codes, making
    // every call from the dashboard fail immediately.
    // Fix: upsert the room — create it if missing, use it if it already exists.
    let room = await prisma.room.findUnique({ where: { code: roomCode } });

    if (!room) {
      room = await prisma.room.create({
        data: {
          code:     roomCode,
          name:     roomCode,
          hostId:   req.user.id,
          isActive: false,
          isEnded:  false,
        },
      });
      logger.info("Room auto-created on join", { roomCode, hostId: req.user.id });
    }

    if (room.isEnded) {
      return res.status(410).json({ error: "Room has ended" });
    }

    const user  = req.user;
    const isHost = room.hostId === user.id;

    // Tier-based participant limits
    const TIER_LIMITS = {
      FREE: 10, STARTER: 50, PRO: 100, BUSINESS: 300, ENTERPRISE: 1000,
    };
    const limit = TIER_LIMITS[user.subscriptionTier] || 10;

    // Check current participant count
    let currentCount = 0;
    try {
      const participants = await listParticipants(roomCode);
      currentCount = participants.length;
    } catch (_) {
      // Room not yet created in LiveKit — will be created on first join
    }

    if (currentCount >= limit && !isHost) {
      return res.status(403).json({
        error: `Participant limit (${limit}) reached for ${user.subscriptionTier} plan`,
        upgradeUrl: "/pricing",
      });
    }

    // Recording permission requires STARTER or higher
    const canRecord = ["STARTER", "PRO", "BUSINESS", "ENTERPRISE"].includes(
      user.subscriptionTier
    );

    // Generate token
    const token = generateToken({
      roomName:        roomCode,
      participantId:   user.id,
      participantName: participantName || user.name,
      canPublish:      true,
      canSubscribe:    true,
      canRecord,
      isAdmin:         isHost,
      ttlSeconds:      4 * 3600,  // 4 hours
    });

    // Ensure LiveKit room exists (idempotent)
    try {
      await createRoom(roomCode, { maxParticipants: limit });
    } catch (e) {
      if (!e.message?.includes("already exists")) {
        logger.warn("LiveKit createRoom warning", { error: e.message });
      }
    }

    // Track join in DB
    await prisma.roomParticipant.upsert({
      where:  { roomId_userId: { roomId: room.id, userId: user.id } },
      update: { joinedAt: new Date(), isActive: true },
      create: {
        roomId:   room.id,
        userId:   user.id,
        joinedAt: new Date(),
        isActive: true,
        role:     isHost ? "HOST" : "PARTICIPANT",
      },
    }).catch(() => {});  // Non-critical

    const rtcConfig = buildRTCConfiguration(user.id, relayOnly);

    logger.info("LiveKit token issued", {
      userId:   user.id,
      roomCode,
      isHost,
      canRecord,
      relayOnly,
    });

    res.json({
      token,
      roomName:  roomCode,
      rtcConfig,
      liveKitHost: process.env.LIVEKIT_HOST,
      participantId: user.id,
      isHost,
      canRecord,
    });
  } catch (err) {
    logger.error("Token generation failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/livekit/ice-servers
// Returns just the ICE server list (TURN/STUN).
// Used by custom WebRTC setups and Flutter clients (your RTCConfiguration).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/ice-servers", requireAuth, (req, res) => {
  try {
    const userId    = req.user?.id || "anon";
    const relayOnly = req.query.relayOnly === "true";
    const iceServers = buildIceServers(userId, 3600);

    res.json({
      iceServers,
      iceTransportPolicy: relayOnly ? "relay" : "all",
      ttlSeconds: 3600,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/livekit/rtc-config
// Returns the full RTCConfiguration object for the client.
// Used by Flutter app:
//   final config = await api.get('/api/livekit/rtc-config');
//   final room = await livekit.connect(url, token, roomOptions: RoomOptions(rtcConfig: config));
// ─────────────────────────────────────────────────────────────────────────────
router.get("/rtc-config", requireAuth, (req, res) => {
  try {
    const userId    = req.user?.id || "anon";
    const relayOnly = req.query.relayOnly === "true";
    const config    = buildRTCConfiguration(userId, relayOnly);

    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/livekit/rooms  — admin only
// ─────────────────────────────────────────────────────────────────────────────
router.post("/rooms", requireAuth, requireTier("BUSINESS"), async (req, res) => {
  try {
    const { roomName, maxParticipants = 100, emptyTimeout = 300 } = req.body;
    const room = await createRoom(roomName, { maxParticipants, emptyTimeout });
    res.json({ room });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/livekit/rooms
// ─────────────────────────────────────────────────────────────────────────────
router.get("/rooms", requireAuth, requireTier("BUSINESS"), async (_req, res) => {
  try {
    const rooms = await listRooms();
    res.json({ rooms, count: rooms.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/livekit/rooms/:name
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/rooms/:name", requireAuth, async (req, res) => {
  try {
    const room = await prisma.room.findFirst({
      where: { code: req.params.name, hostId: req.user.id },
    });
    if (!room) return res.status(403).json({ error: "Not authorized" });

    await deleteRoom(req.params.name);
    await prisma.room.update({
      where: { id: room.id },
      data:  { isEnded: true, endedAt: new Date() },
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/livekit/rooms/:name/participants
// ─────────────────────────────────────────────────────────────────────────────
router.get("/rooms/:name/participants", requireAuth, async (req, res) => {
  try {
    const participants = await listParticipants(req.params.name);
    res.json({ participants, count: participants.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/livekit/rooms/:name/participants/:identity  (kick)
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/rooms/:name/participants/:identity", requireAuth, async (req, res) => {
  try {
    const room = await prisma.room.findFirst({
      where: { code: req.params.name, hostId: req.user.id },
    });
    if (!room) return res.status(403).json({ error: "Only host can remove participants" });

    await removeParticipant(req.params.name, req.params.identity);
    res.json({ success: true, removed: req.params.identity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/livekit/rooms/:name/mute
// Body: { participantIdentity, trackSid, muted }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/rooms/:name/mute", requireAuth, async (req, res) => {
  try {
    const { participantIdentity, trackSid, muted } = req.body;
    await muteParticipantTrack(req.params.name, participantIdentity, trackSid, muted);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/livekit/recording/start
// Body: { roomName }
// Requires STARTER+ plan
// ─────────────────────────────────────────────────────────────────────────────
router.post("/recording/start", requireAuth, requireTier("STARTER"), async (req, res) => {
  try {
    const { roomName } = req.body;
    if (!roomName) return res.status(400).json({ error: "roomName required" });

    const s3Key = `recordings/${roomName}/${Date.now()}.mp4`;
    const s3Uri = `s3://${process.env.S3_BUCKET_NAME}/${s3Key}`;

    const egress = await startRecording(roomName, s3Uri);

    // Persist to DB
    const room = await prisma.room.findFirst({ where: { code: roomName } });
    if (room) {
      await prisma.recording.create({
        data: {
          roomId:    room.id,
          startedBy: req.user.id,
          s3Key,
          egressId:  egress.egressId,
          status:    "RECORDING",
          startedAt: new Date(),
        },
      });
    }

    logger.info("Recording started", { roomName, egressId: egress.egressId });
    res.json({ success: true, egressId: egress.egressId, s3Key });
  } catch (err) {
    logger.error("Recording start failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/livekit/recording/stop
// Body: { egressId }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/recording/stop", requireAuth, async (req, res) => {
  try {
    const { egressId } = req.body;
    if (!egressId) return res.status(400).json({ error: "egressId required" });

    await stopRecording(egressId);

    await prisma.recording.updateMany({
      where:  { egressId },
      data:   { status: "COMPLETED", endedAt: new Date() },
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/livekit/webhook
// LiveKit sends events here: participant_joined, participant_left,
// room_started, room_finished, egress_started, egress_ended, etc.
// Must be registered in LiveKit Cloud Dashboard → Webhooks.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/webhook", express.raw({ type: "*/*" }), async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const event      = verifyWebhook(req.body, authHeader);

    logger.info("LiveKit webhook", { event: event.event, room: event.room?.name });

    switch (event.event) {
      case "room_started": {
        await prisma.room.updateMany({
          where: { code: event.room.name },
          data:  { isActive: true },
        });
        break;
      }

      case "room_finished": {
        await prisma.room.updateMany({
          where: { code: event.room.name },
          data:  { isActive: false, isEnded: true, endedAt: new Date() },
        });
        break;
      }

      case "participant_joined": {
        logger.info("Participant joined", {
          room:     event.room.name,
          identity: event.participant.identity,
        });
        break;
      }

      case "participant_left": {
        await prisma.roomParticipant.updateMany({
          where: {
            room:   { code: event.room.name },
            user:   { id: event.participant.identity },
          },
          data: { isActive: false, leftAt: new Date() },
        }).catch(() => {});
        break;
      }

      case "egress_ended": {
        // Recording finished — update DB and trigger transcription
        await prisma.recording.updateMany({
          where: { egressId: event.egressInfo?.egressId },
          data:  { status: "COMPLETED", endedAt: new Date() },
        }).catch(() => {});
        break;
      }

      default:
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    logger.error("Webhook verification failed", { error: err.message });
    res.status(401).json({ error: "Invalid webhook signature" });
  }
});

module.exports = router;
