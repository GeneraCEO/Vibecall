// src/routes/auth.js
// POST /api/auth/register  — create account
// POST /api/auth/login     — sign in
// POST /api/auth/logout    — clear cookie
// GET  /api/auth/me        — current user profile
// POST /api/auth/refresh   — issue a new access token from refresh token

const router  = require("express").Router();
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { body, validationResult } = require("express-validator");

const prisma   = require("../config/db");
const logger   = require("../config/logger");
const { authenticate } = require("../middleware/auth");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_TTL  = "15m";   // short-lived, stored in cookie
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

/**
 * Build the JWT payload and sign it.
 */
function signAccessToken(user) {
  return jwt.sign(
    {
      id:               user.id,
      email:            user.email,
      name:             user.name,
      subscriptionTier: user.subscriptionTier,
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

/**
 * Set the JWT as an httpOnly, Secure (in prod) cookie.
 * httpOnly: JS cannot read it (prevents XSS token theft).
 * sameSite: "strict" prevents CSRF.
 */
function setAuthCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    secure:   process.env.COOKIE_SECURE === "true",
    sameSite: "strict",
    maxAge:   15 * 60 * 1000, // 15 minutes — matches JWT expiry
  });
}

function setRefreshCookie(res, token) {
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure:   process.env.COOKIE_SECURE === "true",
    sameSite: "strict",
    maxAge:   REFRESH_TOKEN_TTL,
    path:     "/api/auth/refresh", // restrict refresh cookie to refresh endpoint only
  });
}

// ─── Validation rules ─────────────────────────────────────────────────────────

const registerValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage("Name must be 2–80 characters"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email required"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Password must contain an uppercase letter")
    .matches(/[0-9]/).withMessage("Password must contain a number"),
];

const loginValidation = [
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty(),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/auth/register
router.post("/register", registerValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password } = req.body;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: { name, email, password: hashed },
      select: { id: true, name: true, email: true, subscriptionTier: true, createdAt: true },
    });

    const accessToken  = signAccessToken(user);
    const refreshToken = uuidv4();

    await prisma.refreshToken.create({
      data: {
        token:     refreshToken,
        userId:    user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL),
      },
    });

    setAuthCookie(res, accessToken);
    setRefreshCookie(res, refreshToken);

    logger.info("New user registered", { userId: user.id, email: user.email });

    return res.status(201).json({ user });
  } catch (err) {
    logger.error("Registration error", { error: err.message });
    return res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

// POST /api/auth/login
router.post("/login", loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Constant-time compare regardless of whether user exists (prevents timing attacks)
    const passwordMatch = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.hash("dummy", SALT_ROUNDS).then(() => false);

    if (!user || !passwordMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const accessToken  = signAccessToken(user);
    const refreshToken = uuidv4();

    // Clean up old refresh tokens for this user, then create new one
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } },
    });

    await prisma.refreshToken.create({
      data: {
        token:     refreshToken,
        userId:    user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL),
      },
    });

    setAuthCookie(res, accessToken);
    setRefreshCookie(res, refreshToken);

    logger.info("User logged in", { userId: user.id });

    return res.json({
      user: {
        id:               user.id,
        name:             user.name,
        email:            user.email,
        subscriptionTier: user.subscriptionTier,
        avatarUrl:        user.avatarUrl,
      },
    });
  } catch (err) {
    logger.error("Login error", { error: err.message });
    return res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// POST /api/auth/logout
router.post("/logout", authenticate, async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }

    res.clearCookie("token", { path: "/" });
    res.clearCookie("refresh_token", { path: "/api/auth/refresh" });

    return res.json({ message: "Logged out successfully." });
  } catch (err) {
    logger.error("Logout error", { error: err.message });
    return res.status(500).json({ error: "Logout failed." });
  }
});

// POST /api/auth/refresh — issue new access token using refresh token cookie
router.post("/refresh", async (req, res) => {
  const incoming = req.cookies.refresh_token;
  if (!incoming) {
    return res.status(401).json({ error: "No refresh token." });
  }

  try {
    const stored = await prisma.refreshToken.findUnique({
      where: { token: incoming },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      res.clearCookie("refresh_token", { path: "/api/auth/refresh" });
      return res.status(401).json({ error: "Refresh token expired. Please sign in again." });
    }

    const newAccessToken = signAccessToken(stored.user);
    setAuthCookie(res, newAccessToken);

    return res.json({ message: "Token refreshed." });
  } catch (err) {
    logger.error("Token refresh error", { error: err.message });
    return res.status(500).json({ error: "Could not refresh token." });
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, name: true, email: true, avatarUrl: true,
        subscriptionTier: true, subscriptionStatus: true,
        subscriptionEndsAt: true, trialEndsAt: true, createdAt: true,
      },
    });

    if (!user) return res.status(404).json({ error: "User not found." });
    return res.json({ user });
  } catch (err) {
    logger.error("Get user error", { error: err.message });
    return res.status(500).json({ error: "Failed to fetch user data." });
  }
});

module.exports = router;
