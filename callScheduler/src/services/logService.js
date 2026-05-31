import { SystemLog } from "../models/mongooseModels.js";

/**
 * Saves a system log directly into the MongoDB database.
 * 
 * @param {string} message - The main log message.
 * @param {string} level - 'info' | 'warn' | 'error' | 'debug'.
 * @param {string} source - 'backend' | 'worker' | 'voice-agent' | 'webhook'.
 * @param {object} meta - Any JSON serializable object with additional metadata.
 */
export async function writeLog(message, level = "info", source = "backend", meta = null) {
  try {
    const time = new Date().toISOString();
    const consoleMsg = `[${time}] [DB Log] [${level.toUpperCase()}] [${source}] ${message}`;

    if (level === "error") {
      console.error(consoleMsg, meta ? JSON.stringify(meta, null, 2) : "");
    } else if (level === "warn") {
      console.warn(consoleMsg, meta ? JSON.stringify(meta, null, 2) : "");
    } else {
      console.log(consoleMsg, meta ? JSON.stringify(meta, null, 2) : "");
    }

    // Save log entry to MongoDB
    await SystemLog.create({
      level,
      message,
      source,
      meta,
    });
  } catch (err) {
    console.error(`[Log Service] ❌ Failed to save log to database:`, err.message);
  }
}
