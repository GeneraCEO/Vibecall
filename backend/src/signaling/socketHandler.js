// src/signaling/socketHandler.js
//
// WebRTC Signaling via Socket.io
//
// Flow:
//  1. Client connects with JWT in auth handshake.
//  2. Client emits "join-room" with { joinToken, roomId }.
//  3. Server validates joinToken, adds socket to room.
//  4. Server tells the new peer who is already in the room ("room-peers").
//  5. New peer creates an RTCPeerConnection for each existing peer, sends "offer".
//  6. Existing peer receives "offer", creates answer, sends "answer".
//  7. Both sides exchange ICE candidates via "ice-candidate".
//  8. On disconnect, server broadcasts "peer-disconnected".
//
// Mesh topology (every peer connects directly to every other peer).
// For > ~8 participants, upgrade to SFU (mediasoup/LiveKit) — see README.

const jwt    = require("jsonwebtoken");
const prisma = require("../config/db");
const logger = require("../config/logger");

// In-memory room state: roomId → Map<socketId, { userId, name, socketId }>
// This supplements the DB for low-latency real-time lookups.
const rooms = new Map();

/**
 * Attach signaling logic to the Socket.io server.
 * Call this once from server.js: attachSignaling(io)
 */
function attachSignaling(io) {
  // ─── Authentication middleware for Socket.io ──────────────────────────────
  io.use((socket, next) => {
    // The client must send its JWT access token in the handshake auth object:
    // socket = io(SERVER_URL, { auth: { token: "<access_jwt>" } })
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = {
        id:   payload.id,
        name: payload.name,
        subscriptionTier: payload.subscriptionTier,
      };
      return next();
    } catch (err) {
      return next(new Error("Invalid or expired token"));
    }
  });

  // ─── Connection ───────────────────────────────────────────────────────────
  io.on("connection", (socket) => {
    logger.debug("Socket connected", { socketId: socket.id, userId: socket.user?.id });

    // ── join-room ─────────────────────────────────────────────────────────
    // Payload: { joinToken: string }
    // joinToken is the short-lived token issued by POST /api/rooms/:code/join
    socket.on("join-room", async ({ joinToken } = {}) => {
      if (!joinToken) {
        return socket.emit("error", { message: "joinToken required" });
      }

      let roomId, userId, name;
      try {
        const payload = jwt.verify(joinToken, process.env.JWT_SECRET);
        roomId = payload.roomId;
        userId = payload.userId;
        name   = payload.name;

        // Verify the JWT subject matches the authenticated socket user
        if (userId !== socket.user.id) {
          return socket.emit("error", { message: "Token mismatch" });
        }
      } catch {
        return socket.emit("error", { message: "Invalid join token" });
      }

      // Verify room is still active in DB
      const room = await prisma.room.findUnique({
        where:  { id: roomId },
        select: { isActive: true, maxParticipants: true, name: true },
      });

      if (!room || !room.isActive) {
        return socket.emit("error", { message: "Room not found or has ended" });
      }

      // ── Enforce participant limit ──────────────────────────────────────
      const currentPeers = rooms.get(roomId)?.size ?? 0;
      if (currentPeers >= room.maxParticipants) {
        return socket.emit("error", { message: "Room is full" });
      }

      // ── Track in memory ───────────────────────────────────────────────
      if (!rooms.has(roomId)) rooms.set(roomId, new Map());

      const roomPeers = rooms.get(roomId);

      // Remove any stale entry for this user (e.g. they reconnected)
      for (const [sid, peer] of roomPeers) {
        if (peer.userId === userId && sid !== socket.id) {
          roomPeers.delete(sid);
        }
      }

      roomPeers.set(socket.id, { userId, name, socketId: socket.id });

      socket.roomId = roomId;
      socket.join(roomId);

      // ── Tell new peer who is already here ─────────────────────────────
      const existingPeers = Array.from(roomPeers.entries())
        .filter(([sid]) => sid !== socket.id)
        .map(([sid, peer]) => ({ socketId: sid, userId: peer.userId, name: peer.name }));

      socket.emit("room-peers", { peers: existingPeers, roomName: room.name });

      // ── Tell existing peers a new person joined ────────────────────────
      socket.to(roomId).emit("peer-joined", {
        socketId: socket.id,
        userId,
        name,
      });

      logger.info("Peer joined room", { roomId, userId, socketId: socket.id, totalPeers: roomPeers.size });
    });

    // ── WebRTC Offer ──────────────────────────────────────────────────────
    // Payload: { targetSocketId: string, sdp: RTCSessionDescriptionInit }
    // New peer sends an offer to each existing peer.
    socket.on("offer", ({ targetSocketId, sdp }) => {
      if (!sdp || !targetSocketId) return;

      io.to(targetSocketId).emit("offer", {
        fromSocketId: socket.id,
        fromName:     socket.user?.name,
        sdp,
      });
    });

    // ── WebRTC Answer ─────────────────────────────────────────────────────
    // Payload: { targetSocketId: string, sdp: RTCSessionDescriptionInit }
    socket.on("answer", ({ targetSocketId, sdp }) => {
      if (!sdp || !targetSocketId) return;

      io.to(targetSocketId).emit("answer", {
        fromSocketId: socket.id,
        sdp,
      });
    });

    // ── ICE Candidate ─────────────────────────────────────────────────────
    // Payload: { targetSocketId: string, candidate: RTCIceCandidateInit }
    socket.on("ice-candidate", ({ targetSocketId, candidate }) => {
      if (!candidate || !targetSocketId) return;

      io.to(targetSocketId).emit("ice-candidate", {
        fromSocketId: socket.id,
        candidate,
      });
    });

    // ── Media state changes (mute/video off) ──────────────────────────────
    // Broadcast to room so everyone's UI can update
    // Payload: { muted?: boolean, videoOff?: boolean }
    socket.on("media-state", ({ muted, videoOff }) => {
      if (!socket.roomId) return;

      socket.to(socket.roomId).emit("peer-media-state", {
        socketId: socket.id,
        muted,
        videoOff,
      });
    });

    // ── Screen share state ────────────────────────────────────────────────
    // Payload: { sharing: boolean }
    socket.on("screen-share-state", ({ sharing }) => {
      if (!socket.roomId) return;

      socket.to(socket.roomId).emit("peer-screen-share", {
        socketId: socket.id,
        sharing,
      });
    });

    // ── Chat message ─────────────────────────────────────────────────────
    // Persist to DB + broadcast to room
    // Payload: { text: string, encrypted?: boolean }
    socket.on("chat-message", async ({ text, encrypted = false }) => {
      if (!socket.roomId || !text?.trim()) return;

      // Sanitise length
      const sanitised = text.trim().slice(0, 2000);

      try {
        const message = await prisma.chatMessage.create({
          data: {
            roomId:    socket.roomId,
            userId:    socket.user.id,
            text:      sanitised,
            encrypted,
          },
          select: { id: true, text: true, encrypted: true, createdAt: true,
                    user: { select: { id: true, name: true } } },
        });

        // Broadcast to everyone in the room (including sender)
        io.to(socket.roomId).emit("chat-message", message);
      } catch (err) {
        logger.error("Chat persist error", { error: err.message });
        socket.emit("error", { message: "Could not send message." });
      }
    });

    // ── Raise / lower hand ────────────────────────────────────────────────
    socket.on("raise-hand", ({ raised }) => {
      if (!socket.roomId) return;
      socket.to(socket.roomId).emit("peer-hand", { socketId: socket.id, raised });
    });

    // ── Disconnect ────────────────────────────────────────────────────────
    socket.on("disconnect", async (reason) => {
      logger.debug("Socket disconnected", { socketId: socket.id, reason, userId: socket.user?.id });

      const roomId = socket.roomId;
      if (!roomId) return;

      const roomPeers = rooms.get(roomId);
      if (roomPeers) {
        roomPeers.delete(socket.id);
        if (roomPeers.size === 0) rooms.delete(roomId);
      }

      // Notify remaining peers
      socket.to(roomId).emit("peer-disconnected", { socketId: socket.id });

      // Mark participant as left in DB
      try {
        await prisma.roomParticipant.updateMany({
          where: { roomId, userId: socket.user?.id, leftAt: null },
          data:  { leftAt: new Date() },
        });
      } catch (err) {
        logger.error("Failed to update participant left time", { error: err.message });
      }
    });
  });
}

/** Return current number of peers in a room (for debugging/admin). */
function getRoomSize(roomId) {
  return rooms.get(roomId)?.size ?? 0;
}

module.exports = { attachSignaling, getRoomSize };
