// src/middleware/auth.js
// Validates the JWT stored in an httpOnly cookie.
// Attaches req.user = { id, email, name, subscriptionTier } on success.

const jwt = require("jsonwebtoken");
const logger = require("../config/logger");

/**
 * Require a valid JWT.
 * Returns 401 if token is missing or invalid.
 */
const authenticate = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the full decoded payload so routes know the user
    req.user = {
      id:               payload.id,
      email:            payload.email,
      name:             payload.name,
      subscriptionTier: payload.subscriptionTier,
    };

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Session expired. Please sign in again." });
    }
    logger.warn("Invalid JWT", { error: err.message });
    return res.status(401).json({ error: "Invalid token" });
  }
};

/**
 * Optional auth — attaches user if valid token present, does not block if not.
 * Useful for routes that behave differently for logged-in users.
 */
const optionalAuth = (req, res, next) => {
  const token = req.cookies?.token;
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // Token invalid — continue as unauthenticated
    }
  }
  next();
};

/**
 * Require a specific subscription tier or higher.
 * Tier order: FREE < STARTER < PRO < BUSINESS < ENTERPRISE
 */
const TIER_ORDER = { FREE: 0, STARTER: 1, PRO: 2, BUSINESS: 3, ENTERPRISE: 4 };

const requireTier = (minTier) => (req, res, next) => {
  const userTier = req.user?.subscriptionTier || "FREE";
  if ((TIER_ORDER[userTier] ?? 0) >= (TIER_ORDER[minTier] ?? 0)) {
    return next();
  }
  return res.status(403).json({
    error: `This feature requires a ${minTier} plan or higher.`,
    upgradeUrl: "/pricing",
  });
};

module.exports = { authenticate, requireAuth: authenticate, optionalAuth, requireTier };
