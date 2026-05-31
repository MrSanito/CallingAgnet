import { SystemLog } from "../models/mongooseModels.js";

/**
 * GET /api/v1/logs
 * 
 * Fetches system logs stored in MongoDB.
 * Optional query parameters:
 *  - limit: number (default: 100)
 *  - level: 'info' | 'warn' | 'error' | 'debug'
 *  - source: 'backend' | 'worker' | 'voice-agent' | 'webhook'
 */
export async function getLogs(req, res, next) {
  try {
    const { limit = 100, level, source } = req.query;

    const query = {};
    if (level) {
      query.level = level;
    }
    if (source) {
      query.source = source;
    }

    const logs = await SystemLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (err) {
    next(err);
  }
}
