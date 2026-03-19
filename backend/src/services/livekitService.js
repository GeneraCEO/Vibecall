/**
 * livekitService.js
 * VibeCall — LiveKit Cloud Integration
 *
 * All credentials are fully wired.
 * API Key    : APIpYn9E7HHDhwA
 * API Secret : neNxvKn9WtiD7FNBmV8gmmKjrYU3C9cdDef7mWm1gttB
 * WSS Host   : wss://vibecall-xizkbpz8.livekit.cloud
 * TURN User  : c975adebb62761d65ddcb2b8
 * TURN Cred  : HOrsTABhHqDjt3PE
 */
"use strict";

const crypto = require("crypto");
const {
  AccessToken,
  RoomServiceClient,
  WebhookReceiver,
  VideoGrant,
} = require("livekit-server-sdk");

// ─── Credentials (env vars take priority; hardcoded as secure fallbacks) ───────
const LK = {
  key:    process.env.LIVEKIT_API_KEY    || "APIpYn9E7HHDhwA",
  secret: process.env.LIVEKIT_API_SECRET || "neNxvKn9WtiD7FNBmV8gmmKjrYU3C9cdDef7mWm1gttB",
  host:   process.env.LIVEKIT_HOST       || "wss://vibecall-xizkbpz8.livekit.cloud",
};

const TURN = {
  host:       process.env.TURN_HOST_US    || "openrelay.metered.ca",
  username:   process.env.TURN_USERNAME   || "c975adebb62761d65ddcb2b8",
  credential: process.env.TURN_CREDENTIAL || "HOrsTABhHqDjt3PE",
  secret:     process.env.TURN_SECRET     || "",  // for self-hosted Coturn (HMAC)
};

// Regional self-hosted Coturn — add hosts when you spin up VMs
const COTURN_REGIONS = [
  process.env.TURN_HOST_EU,
  process.env.TURN_HOST_ASIA,
  process.env.TURN_HOST_ME,
  process.env.TURN_HOST_AF,
  process.env.TURN_HOST_SA,
].filter(Boolean);

// ─── Singleton clients ────────────────────────────────────────────────────────
const clients = {
  _room: null,
  _hook: null,
  room() {
    if (!this._room) {
      this._room = new RoomServiceClient(LK.host, LK.key, LK.secret);
    }
    return this._room;
  },
  webhook() {
    if (!this._hook) this._hook = new WebhookReceiver(LK.key, LK.secret);
    return this._hook;
  },
};

// ─── HMAC credential generator (RFC 5389) ─────────────────────────────────────
// Used only for self-hosted Coturn. Falls back to static Metered creds.
function makeTurnCredential(userId = "anon", ttl = 3600) {
  if (!TURN.secret) return { username: TURN.username, credential: TURN.credential };
  const exp  = Math.floor(Date.now() / 1000) + ttl;
  const user = `${exp}:${userId}`;
  return {
    username:   user,
    credential: crypto.createHmac("sha1", TURN.secret).update(user).digest("base64"),
  };
}

// ─── ICE Servers ──────────────────────────────────────────────────────────────
/**
 * Returns iceServers array for RTCPeerConnection / LiveKit RoomOptions.
 *
 * Transport strategy:
 *   STUN             → direct P2P (lowest latency, no relay)
 *   TURN UDP :80     → relay for symmetric NAT (most home/mobile networks)
 *   TURN TCP :80     → when UDP is blocked (some corporate nets)
 *   TURN TCP :443    → hotel/airport/university (port 443 always open)
 *   TURNS TLS :443   → enterprise/government firewalls (encrypted on HTTPS port)
 */
function buildIceServers(userId = "anon", ttl = 3600) {
  const cred = makeTurnCredential(userId, ttl);

  const servers = [
    // Free STUN — Google + Cloudflare
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
      ],
    },
    { urls: "stun:stun.cloudflare.com:3478" },

    // Metered.ca TURN — all 4 transports for maximum firewall penetration
    {
      urls: [
        `turn:${TURN.host}:80?transport=udp`,
        `turn:${TURN.host}:80?transport=tcp`,
        `turn:${TURN.host}:443?transport=tcp`,
        `turns:${TURN.host}:443?transport=tcp`,
      ],
      username:   TURN.username,
      credential: TURN.credential,
    },
  ];

  // Self-hosted regional nodes (populated when env vars are set)
  COTURN_REGIONS.forEach(host => {
    servers.push({
      urls: [
        `turn:${host}:3478?transport=udp`,
        `turn:${host}:3478?transport=tcp`,
        `turns:${host}:5349?transport=tcp`,
        `turn:${host}:443?transport=tcp`,
      ],
      ...cred,
    });
  });

  return servers;
}

// ─── RTCConfiguration ─────────────────────────────────────────────────────────
function buildRTCConfiguration(userId = "anon", relayOnly = false) {
  return {
    iceServers:           buildIceServers(userId),
    iceTransportPolicy:   relayOnly ? "relay" : "all",
    bundlePolicy:         "max-bundle",
    rtcpMuxPolicy:        "require",
    sdpSemantics:         "unified-plan",
    iceCandidatePoolSize: 5,
  };
}

// ─── Generate participant JWT ──────────────────────────────────────────────────
function generateToken({
  roomName,
  participantId,
  participantName,
  canPublish   = true,
  canSubscribe = true,
  canRecord    = false,
  isAdmin      = false,
  ttlSeconds   = 14400,
} = {}) {
  const at = new AccessToken(LK.key, LK.secret, {
    identity: String(participantId),
    name:     participantName,
    ttl:      ttlSeconds,
  });

  at.addGrant(new VideoGrant({
    roomJoin:             true,
    room:                 roomName,
    canPublish,
    canSubscribe,
    canPublishData:       true,
    canUpdateOwnMetadata: true,
    roomRecord:           canRecord,
    roomAdmin:            isAdmin,
    hidden:               false,
    recorder:             false,
  }));

  return at.toJwt();
}

// ─── Room management ──────────────────────────────────────────────────────────
const createRoom = (name, opts = {}) =>
  clients.room().createRoom({
    name,
    maxParticipants: opts.maxParticipants || 300,
    emptyTimeout:    opts.emptyTimeout    || 300,
    metadata:        JSON.stringify({ app: "vibecall", ts: Date.now() }),
  });

const listRooms            = ()                     => clients.room().listRooms();
const deleteRoom           = name                   => clients.room().deleteRoom(name);
const listParticipants     = name                   => clients.room().listParticipants(name);
const removeParticipant    = (room, id)             => clients.room().removeParticipant(room, id);
const muteParticipantTrack = (room, id, sid, muted) => clients.room().mutePublishedTrack(room, id, sid, muted);

// ─── Cloud Recording ──────────────────────────────────────────────────────────
async function startRecording(roomName, s3Uri) {
  const { EgressClient, EncodedFileOutput, EncodedFileType } = require("livekit-server-sdk");
  const egress = new EgressClient(LK.host, LK.key, LK.secret);
  return egress.startRoomCompositeEgress(roomName, {
    file: new EncodedFileOutput({ fileType: EncodedFileType.MP4, filepath: s3Uri }),
  });
}

async function stopRecording(egressId) {
  const { EgressClient } = require("livekit-server-sdk");
  return new EgressClient(LK.host, LK.key, LK.secret).stopEgress(egressId);
}

// ─── Webhook ──────────────────────────────────────────────────────────────────
const verifyWebhook = (rawBody, authHeader) =>
  clients.webhook().receive(rawBody, authHeader);

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  LK,
  TURN,
  buildIceServers,
  buildRTCConfiguration,
  generateToken,
  createRoom,
  listRooms,
  deleteRoom,
  listParticipants,
  removeParticipant,
  muteParticipantTrack,
  startRecording,
  stopRecording,
  verifyWebhook,
};
