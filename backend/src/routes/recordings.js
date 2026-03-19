// src/routes/recordings.js
// Recordings: start (create DB row), get presigned S3 upload URL,
// finalize (mark ready), list, stream, delete.

const router = require("express").Router();
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");
const { param, body, validationResult } = require("express-validator");

const prisma  = require("../config/db");
const logger  = require("../config/logger");
const { authenticate, requireTier } = require("../middleware/auth");

// ─── S3 Client ────────────────────────────────────────────────────────────────

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME;

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/recordings/start
 * Called when a participant starts recording in a room.
 * Creates a DB row and returns a presigned S3 URL so the client can
 * upload chunks directly to S3 without going through our server.
 *
 * Requires STARTER tier or above.
 */
router.post(
  "/start",
  authenticate,
  requireTier("STARTER"),
  [
    body("roomId").notEmpty().withMessage("roomId required"),
    body("mimeType")
      .optional()
      .isIn(["video/webm", "video/mp4", "video/webm;codecs=vp9"])
      .withMessage("Unsupported mime type"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { roomId, mimeType = "video/webm" } = req.body;

    try {
      // Verify user is a participant in the room
      const participant = await prisma.roomParticipant.findUnique({
        where: { roomId_userId: { roomId, userId: req.user.id } },
        include: { room: { select: { isActive: true, allowRecording: true } } },
      });

      if (!participant) return res.status(403).json({ error: "You are not in this room." });
      if (!participant.room.isActive) return res.status(410).json({ error: "Meeting has ended." });
      if (!participant.room.allowRecording) return res.status(403).json({ error: "Recording is disabled for this room." });

      const recordingId = uuidv4();
      const extension   = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
      const s3Key       = `recordings/${roomId}/${recordingId}.${extension}`;

      // Create DB row first (status: RECORDING)
      const recording = await prisma.recording.create({
        data: {
          id:       recordingId,
          roomId,
          userId:   req.user.id,
          s3Key,
          s3Bucket: BUCKET,
          mimeType,
          status:   "RECORDING",
        },
      });

      // Presigned PUT URL — valid for 2 hours (max recording length we support)
      const command = new PutObjectCommand({
        Bucket:      BUCKET,
        Key:         s3Key,
        ContentType: mimeType,
      });

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 7200 });

      logger.info("Recording started", { recordingId, roomId, userId: req.user.id });

      return res.status(201).json({
        recordingId: recording.id,
        uploadUrl,
        s3Key,
      });
    } catch (err) {
      logger.error("Start recording error", { error: err.message });
      return res.status(500).json({ error: "Could not start recording." });
    }
  }
);

/**
 * PATCH /api/recordings/:id/finalize
 * Client calls this after the MediaRecorder finishes and the file is
 * fully uploaded to S3. Updates size and duration, sets status to READY.
 */
router.patch(
  "/:id/finalize",
  authenticate,
  [
    param("id").isUUID(),
    body("duration").isInt({ min: 0 }).withMessage("Duration (seconds) required"),
    body("fileSize").isInt({ min: 0 }).withMessage("File size (bytes) required"),
    body("title").optional().trim().isLength({ max: 200 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { duration, fileSize, title } = req.body;

    try {
      const recording = await prisma.recording.findUnique({ where: { id: req.params.id } });

      if (!recording) return res.status(404).json({ error: "Recording not found." });
      if (recording.userId !== req.user.id) return res.status(403).json({ error: "Not your recording." });

      const updated = await prisma.recording.update({
        where: { id: req.params.id },
        data:  {
          status:   "READY",
          duration,
          fileSize: BigInt(fileSize),
          title:    title || `Recording ${new Date().toLocaleDateString()}`,
        },
        select: { id: true, title: true, duration: true, status: true, createdAt: true },
      });

      logger.info("Recording finalized", { recordingId: updated.id, duration });

      return res.json({ recording: updated });
    } catch (err) {
      logger.error("Finalize recording error", { error: err.message });
      return res.status(500).json({ error: "Could not finalize recording." });
    }
  }
);

/**
 * GET /api/recordings
 * List all recordings for the authenticated user.
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const rawRecordings = await prisma.recording.findMany({
      where:   { userId: req.user.id, status: "READY" },
      orderBy: { createdAt: "desc" },
      take:    100,
      select: {
        id: true, title: true, duration: true, mimeType: true,
        fileSize: true, status: true, createdAt: true,
        room: { select: { id: true, name: true, code: true } },
      },
    });

    // BigInt → string for JSON serialisation
    const recordings = rawRecordings.map(r => ({
      ...r,
      fileSize: r.fileSize.toString(),
    }));

    return res.json({ recordings });
  } catch (err) {
    logger.error("List recordings error", { error: err.message });
    return res.status(500).json({ error: "Could not fetch recordings." });
  }
});

/**
 * GET /api/recordings/:id/stream
 * Return a short-lived presigned S3 GET URL for playback.
 */
router.get("/:id/stream", authenticate, async (req, res) => {
  try {
    const recording = await prisma.recording.findUnique({ where: { id: req.params.id } });

    if (!recording) return res.status(404).json({ error: "Recording not found." });
    if (recording.userId !== req.user.id) return res.status(403).json({ error: "Not your recording." });
    if (recording.status !== "READY") return res.status(409).json({ error: "Recording is not ready yet." });

    const command = new GetObjectCommand({ Bucket: recording.s3Bucket, Key: recording.s3Key });
    const streamUrl = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1-hour URL

    return res.json({ streamUrl });
  } catch (err) {
    logger.error("Stream recording error", { error: err.message });
    return res.status(500).json({ error: "Could not generate stream URL." });
  }
});

/**
 * DELETE /api/recordings/:id
 * Delete recording from S3 and DB.
 */
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const recording = await prisma.recording.findUnique({ where: { id: req.params.id } });

    if (!recording) return res.status(404).json({ error: "Recording not found." });
    if (recording.userId !== req.user.id) return res.status(403).json({ error: "Not your recording." });

    // Delete from S3
    await s3.send(new DeleteObjectCommand({ Bucket: recording.s3Bucket, Key: recording.s3Key }));

    // Delete from DB
    await prisma.recording.delete({ where: { id: req.params.id } });

    logger.info("Recording deleted", { recordingId: req.params.id });

    return res.json({ message: "Recording deleted." });
  } catch (err) {
    logger.error("Delete recording error", { error: err.message });
    return res.status(500).json({ error: "Could not delete recording." });
  }
});

module.exports = router;
