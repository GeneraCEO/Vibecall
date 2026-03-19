// src/services/turnService.js
// Returns ICE server config (STUN + TURN) for RTCPeerConnection.
// This endpoint is called by the client before creating any peer connections.
//
// OPTION A — Metered.ca (recommended for getting started, free tier):
//   Sign up at https://www.metered.ca, get METERED_API_KEY, set env vars.
//
// OPTION B — Self-hosted Coturn:
//   See https://github.com/coturn/coturn
//   Docker: docker run -d -p 3478:3478 -p 3478:3478/udp coturn/coturn
//   Set COTURN_* env vars.
//
// OPTION C — For development only (no TURN, just Google STUN):
//   Works for local network and same-LAN connections. Will fail across NATs.

const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const logger = require("../config/logger");

/**
 * Fetch TURN credentials from Metered.ca's REST API.
 * Credentials are time-limited (typically 1 hour) — never hardcode them.
 */
async function getMeteredIceServers() {
  if (!process.env.METERED_API_KEY || !process.env.METERED_APP_NAME) {
    throw new Error("Metered env vars not set");
  }

  const url = `https://${process.env.METERED_APP_NAME}.metered.live/api/v1/turn/credentials?apiKey=${process.env.METERED_API_KEY}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Metered API returned ${response.status}`);
  }

  return response.json(); // Array of { urls, username, credential }
}

/**
 * Build ICE server list from self-hosted Coturn credentials.
 */
function getCoturnIceServers() {
  const host       = process.env.COTURN_HOST;
  const port       = process.env.COTURN_PORT || 3478;
  const username   = process.env.COTURN_USERNAME;
  const credential = process.env.COTURN_CREDENTIAL;

  if (!host || !username || !credential) {
    throw new Error("Coturn env vars not set");
  }

  return [
    { urls: [`stun:${host}:${port}`] },
    { urls: [`turn:${host}:${port}?transport=udp`], username, credential },
    { urls: [`turn:${host}:${port}?transport=tcp`], username, credential },
    { urls: [`turns:${host}:${port}?transport=tcp`], username, credential }, // TLS TURN
  ];
}

// GET /api/ice-servers
// Client calls this once per room join to get fresh ICE server config.
// Authenticated because we don't want to expose TURN credentials publicly.
router.get("/", authenticate, async (req, res) => {
  try {
    let iceServers;

    if (process.env.METERED_API_KEY) {
      iceServers = await getMeteredIceServers();
    } else if (process.env.COTURN_HOST) {
      iceServers = getCoturnIceServers();
    } else {
      // Development fallback — Google public STUN only
      // NOTE: This will NOT work for peers behind NAT in production.
      logger.warn("No TURN server configured. Using STUN only — will fail across NATs.");
      iceServers = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ];
    }

    // Cache-Control: short TTL so credentials stay fresh
    res.set("Cache-Control", "private, max-age=3600");
    return res.json({ iceServers });
  } catch (err) {
    logger.error("ICE server fetch failed", { error: err.message });

    // Fallback to public STUN on error — better than nothing
    return res.json({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
      warning: "TURN server unavailable. Connections across NAT may fail.",
    });
  }
});

module.exports = router;
