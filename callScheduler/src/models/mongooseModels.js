// src/models/mongooseModels.js
import mongoose from "mongoose";

const { Schema } = mongoose;

// ── 1. LEAD SCHEMA ─────────────────────────────────────────────────────────────
const LeadSchema = new Schema(
  {
    RcromId: { type: Number, default: null },
    clientName: { type: String, required: true, trim: true },
    shopName: { type: String, trim: true, default: "" },
    clientNumber: { type: String, required: true, unique: true, trim: true },
    clientRequirement: { type: String, required: true },
    clientOtherDetails: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["pending", "active", "completed", "failed"],
      default: "pending",
    },
    totalAttempts: { type: Number, default: 0 },
    crmLabelIds: { type: [Number], default: [] },
    crmLabelNames: { type: [String], default: [] },
    crmLeadStatusId: { type: Number, default: null },

    // ── NEW ──────────────────────────────────────────────────────────────────
    // Override per-lead instead of hardcoding 3 everywhere in logic
    maxAttempts: { type: Number, default: 3 },

    // VIP leads jump the BullMQ queue; higher number = higher priority
    priority: { type: Number, default: 0 },

    // Timezone-aware scheduling (IANA string, e.g. "Asia/Kolkata")
    timezone: { type: String, default: "Asia/Kolkata" },

    // Allowed call window in local time — avoids calling at 2 AM
    preferredCallWindow: {
      start: { type: String, default: "09:00" }, // "HH:mm"
      end:   { type: String, default: "19:00" },
    },

    // Tags for segmentation (e.g. ["hot", "Q2-campaign"])
    tags: { type: [String], default: [] },

    // Soft-delete — never hard-delete leads; keeps audit history intact
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

LeadSchema.index({ clientNumber: 1 });
// Compound: worker queries pending leads sorted by priority
LeadSchema.index({ status: 1, priority: -1, createdAt: 1 });

export const Lead = mongoose.models.Lead || mongoose.model("Lead", LeadSchema);


// ── 2. VIDEOSDK ROOM SCHEMA ───────────────────────────────────────────────────
const VideoSdkRoomSchema = new Schema(
  {
    roomId: { type: String, required: true, unique: true, trim: true },
    customRoomId: { type: String, required: true, unique: true, trim: true },
    userId: { type: String, default: null },
    disabled: { type: Boolean, default: false },

    // ── NEW ──────────────────────────────────────────────────────────────────
    // Back-reference so you can query "which call used this room?" without a join
    callId: { type: Schema.Types.ObjectId, ref: "CallHistory", default: null },

    // Lifecycle tracking — enables nightly orphan-cleanup cron
    status: {
      type: String,
      enum: ["provisioned", "active", "expired", "failed"],
      default: "provisioned",
    },

    // VideoSDK rooms have a TTL; store it so a cleanup job can act on it
    expiresAt: { type: Date, default: null },

    // Region the room was provisioned in (useful for latency debugging)
    region: { type: String, default: null },
  },
  { timestamps: true }
);

VideoSdkRoomSchema.index({ roomId: 1 });
VideoSdkRoomSchema.index({ customRoomId: 1 });
// Cleanup job queries: find expired rooms still marked active
VideoSdkRoomSchema.index({ status: 1, expiresAt: 1 });

export const VideoSdkRoom =
  mongoose.models.VideoSdkRoom ||
  mongoose.model("VideoSdkRoom", VideoSdkRoomSchema);


// ── 3. CALL RECORDING SCHEMA ──────────────────────────────────────────────────
const CallRecordingSchema = new Schema(
  {
    recordingId: { type: String, required: true, unique: true, trim: true },
    callId: { type: Schema.Types.ObjectId, ref: "CallHistory", required: true },
    type: { type: String, enum: ["audio", "video", "merge"], default: "merge" },
    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      default: "running",
    },
    fileUrl: { type: String, default: null },
    filePath: { type: String, default: null },
    size: { type: Number, default: null },
    duration: { type: Number, default: null },
    format: { type: String, default: "mp3" },

    // ── NEW ──────────────────────────────────────────────────────────────────
    // VideoSDK CDN presigned URLs expire — track when so you can refresh/warn
    urlExpiresAt: { type: Date, default: null },

    // Idempotency guard: recording webhook can double-fire
    // Store the timestamp, not just a boolean, for audit purposes
    pushedToRcrmAt: { type: Date, default: null },

    // Transcode pipeline status (separate from recording capture status)
    transcodeStatus: {
      type: String,
      enum: ["pending", "processing", "done", "failed", null],
      default: null,
    },
  },
  { timestamps: true }
);

CallRecordingSchema.index({ recordingId: 1 });
CallRecordingSchema.index({ callId: 1 });
// Find recordings that need to be pushed to RCRM
CallRecordingSchema.index({ pushedToRcrmAt: 1, status: 1 });

export const CallRecording =
  mongoose.models.CallRecording ||
  mongoose.model("CallRecording", CallRecordingSchema);


// ── 4. TRANSCRIPT UTTERANCE SCHEMA ───────────────────────────────────────────
const TranscriptSchema = new Schema(
  {
    callId: { type: Schema.Types.ObjectId, ref: "CallHistory", required: true },
    role: {
      type: String,
      enum: ["user", "assistant", "agent", "system"],
      required: true,
    },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },

    // ── NEW ──────────────────────────────────────────────────────────────────
    // Millisecond offsets from call start — enables recording seek-bar sync
    startMs: { type: Number, default: null },
    endMs:   { type: Number, default: null },

    // STT engine confidence score (0.0–1.0); flag low-quality transcriptions
    confidence: { type: Number, min: 0, max: 1, default: null },

    // False = partial/streaming result; true = final committed utterance
    isFinal: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TranscriptSchema.index({ callId: 1 });

export const Transcript =
  mongoose.models.Transcript || mongoose.model("Transcript", TranscriptSchema);


// ── 5. CALL HISTORY SCHEMA ────────────────────────────────────────────────────
const CallHistorySchema = new Schema(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true },
    roomId: { type: String, ref: "VideoSdkRoom", default: null },
    customRoomId: { type: String, default: null },
    attemptCount: { type: Number, default: 1 },
    scheduledAt: { type: Date, default: null },
    startedAt: { type: Date, default: Date.now },
    answeredAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    hangupAt: { type: Date, default: null },
    duration: { type: Number, default: null },
    status: {
      type: String,
      enum: [
        "pending", "active", "completed", "failed",
        "busy", "no_answer", "accepted", "rejected",
        "answered", "missed", "transferred", "transfer-failed",
      ],
      default: "pending",
    },
    transferTo: { type: String, default: null },
    transferStatus: {
      type: String,
      enum: ["success", "failed", null],
      default: null,
    },
    sentiment: { type: String, default: null },
    summary: { type: String, default: null },
    nextAction: { type: String, default: null },
    resolution: {
      type: String,
      enum: [
        "trial_setup", "busy", "wrong_number", "not_interested",
        "deal_closed", "follow_up_needed", "interested",
        "callback_requested", "no_answer", null,
      ],
      default: null,
    },
    tokenUsage: { type: Schema.Types.Mixed, default: null },
    rawTranscript: { type: String, default: null },
    contextHistory: { type: Schema.Types.Mixed, default: null },
    agentLanguage: { type: String, default: null },
    customerName: { type: String, default: null },
    crmLabelIds: { type: [Number], default: [] },
    crmLabelNames: { type: [String], default: [] },
    crmLeadStatusId: { type: Number, default: null },

    // ── NEW ──────────────────────────────────────────────────────────────────
    // Which retry number is this? (1 = first call, 2 = first retry, 3 = last)
    // Webhooks need this to know which attempt they're handling
    attemptNumber: { type: Number, default: 1, min: 1 },

    // Machine-readable reason the call ended — for retry logic + dashboards
    hangupCause: {
      type: String,
      enum: [
        "normal_clearing",   // clean hang-up by either party
        "no_answer",         // rang out
        "busy",              // callee busy
        "rejected",          // callee declined
        "failed",            // carrier/SIP failure
        "transferred",       // handed off to human
        "agent_error",       // Python agent crashed
        null,
      ],
      default: null,
    },

    // Why was this attempt queued as a retry?
    retryReason: {
      type: String,
      enum: ["no_answer", "busy", "failed", "dropped", null],
      default: null,
    },

    // Which Python agent build placed this call — invaluable for regression debugging
    agentVersion: { type: String, default: null },

    // When the BullMQ worker picked up the job — helps measure queue lag
    queuedAt: { type: Date, default: null },
    dialedAt: { type: Date, default: null },

    // SIP / telephony error code if the call failed at the carrier layer
    errorCode: { type: String, default: null },
  },
  { timestamps: true }
);

CallHistorySchema.index({ leadId: 1 });
CallHistorySchema.index({ roomId: 1 });
CallHistorySchema.index({ status: 1 });
// Dashboard: "show me all calls for this lead, newest first"
CallHistorySchema.index({ leadId: 1, createdAt: -1 });
// Analytics: filter by resolution across a date range
CallHistorySchema.index({ resolution: 1, createdAt: -1 });

export const CallHistory =
  mongoose.models.CallHistory ||
  mongoose.model("CallHistory", CallHistorySchema);


// ── 6. SCHEDULED CALLBACK SCHEMA (NEW MODEL) ──────────────────────────────────
// Persists scheduling *intent* separately from BullMQ jobs (which are ephemeral).
// This survives server restarts, enables calendar views, and supports multi-channel
// follow-ups (call, SMS, WhatsApp) without touching the queue directly.
const ScheduledCallbackSchema = new Schema(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true },

    // When to execute (stored in UTC; use lead.timezone for display)
    scheduledFor: { type: Date, required: true },

    // Which channel to use for this follow-up
    channel: {
      type: String,
      enum: ["call", "sms", "whatsapp"],
      default: "call",
    },

    status: {
      type: String,
      enum: ["pending", "queued", "done", "cancelled", "failed"],
      default: "pending",
    },

    // Why this callback was scheduled (for display + analytics)
    reason: {
      type: String,
      enum: ["follow_up", "retry", "callback_requested", "manual", null],
      default: null,
    },

    // The CallHistory that triggered this callback (nullable for manual entries)
    triggeredByCallId: {
      type: Schema.Types.ObjectId,
      ref: "CallHistory",
      default: null,
    },

    // The CallHistory that *executed* this callback (filled after completion)
    executedByCallId: {
      type: Schema.Types.ObjectId,
      ref: "CallHistory",
      default: null,
    },

    // Who/what created this entry — useful for distinguishing cron vs AI vs human
    createdBy: {
      type: String,
      enum: ["agent", "cron", "manual", "webhook"],
      default: "agent",
    },

    // Free-text note (e.g. "customer asked to call back after 5 PM")
    note: { type: String, default: null },
  },
  { timestamps: true }
);

// Cron job query: "find all pending callbacks due in the next 5 minutes"
ScheduledCallbackSchema.index({ status: 1, scheduledFor: 1 });
ScheduledCallbackSchema.index({ leadId: 1, status: 1 });

export const ScheduledCallback =
  mongoose.models.ScheduledCallback ||
  mongoose.model("ScheduledCallback", ScheduledCallbackSchema);


// ── 7. SYSTEM LOG SCHEMA ───────────────────────────────────────────────────────
const SystemLogSchema = new Schema(
  {
    level: {
      type: String,
      enum: ["info", "warn", "error", "debug"],
      default: "info",
    },
    message: { type: String, required: true },
    meta: { type: Schema.Types.Mixed, default: null },
    source: { type: String, default: "system" },
  },
  { timestamps: true }
);

SystemLogSchema.index({ level: 1, createdAt: -1 });

export const SystemLog = mongoose.models.SystemLog || mongoose.model("SystemLog", SystemLogSchema);

