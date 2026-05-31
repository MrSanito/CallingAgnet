import * as webhookService from "../services/webhook.service.js";
import { writeLog } from "../services/logService.js";

/**
 * POST /transcript
 */
export async function handleTranscript(req, res, next) {
  try {
    const roomId = req.body.serviceRoomId || req.body.roomId;
    writeLog(`Transcript webhook received for room: ${roomId}`, "info", "webhook", { roomId, phone: req.body.phone });
    const result = await webhookService.processTranscriptWebhook(req.body);
    return res.status(200).json({
      success: true,
      message: "Transcript processed and database updated",
      ...result
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /recording
 */
export async function handleRecording(req, res, next) {
  try {
    const type = req.body.webhookType || req.body.type || req.body.event;
    const data = req.body.data || {};

    // Silently discard — no log, no processing
    if (type === "participant-left") return res.status(200).json({ success: true });

    const roomId = data.meetingId || data.roomId || req.body.roomId || req.body.serviceRoomId || "?";
    writeLog(`VideoSDK Recording/Room Event Webhook: ${type} | room: ${roomId}`, "info", "webhook", { type, roomId });

    console.log(`\n=================== [WEBHOOK: ${type}] ===================`);
    console.log(JSON.stringify(req.body, null, 2));
    console.log(`====================================================================\n`);

    if (type === "transcription-completed" || (type && type.startsWith("transcription-"))) {
      console.log("Transcript completed webhook triggered. Forwarding internally to /transcript...");
      req.url = "/transcript";
      return req.app.handle(req, res);

    } else if (type === "merge-recording-completed") {
      console.log(`[Webhook Controller] ⏳ Waiting 10 seconds before processing merge-recording...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
      const result = await webhookService.handleRecordingCompleted(data, req);
      return res.status(200).json({
        success: true,
        message: "Call recording details saved successfully",
        ...result
      });

    } else if (type === "call-answered") {
      console.log(`📞✅ CALL ANSWERED | roomId: ${data.meetingId || data.roomId || "?"}`);
      await webhookService.handleCallStatusUpdate(type, data, req);

    } else if (type === "call-missed") {
      console.log(`📞❌ CALL MISSED | roomId: ${data.meetingId || data.roomId || "?"} | Nobody picked up`);
      await webhookService.handleCallStatusUpdate(type, data, req);

    } else if (type === "call-rejected") {
      console.log(`📞🚫 CALL REJECTED | roomId: ${data.meetingId || data.roomId || "?"} | Recipient declined`);
      await webhookService.handleCallStatusUpdate(type, data, req);

    } else if (type === "transfer-failed") {
      console.log(`📞💥 TRANSFER FAILED | roomId: ${data.meetingId || data.roomId || "?"} | SIP transfer error`);
      await webhookService.handleCallStatusUpdate(type, data, req);

    } else if (type === "recording-started") {
      console.log(`🔴🎙️ RECORDING STARTED | roomId: ${data.meetingId || data.roomId || "?"}`);

    } else if (type === "recording-stopped") {
      console.log(`⏹️🎙️ RECORDING STOPPED | roomId: ${data.meetingId || data.roomId || "?"}`);

    } else if (type === "participant-joined") {
      console.log(`👤➡️ PARTICIPANT JOINED | roomId: ${data.meetingId || data.roomId || "?"} | name: ${data.participantName || data.name || "?"}`);

    }  else if (type === "session-started" || type === "meeting-started") {
      console.log(`🟢🚀 SESSION STARTED | roomId: ${data.meetingId || data.roomId || "?"}`);

    } else if (type === "session-ended" || type === "meeting-ended") {
      console.log(`🔴🏁 SESSION ENDED | roomId: ${data.meetingId || data.roomId || "?"}`);

    } else if (type === "livestream-started") {
      console.log(`📡🟢 LIVESTREAM STARTED | roomId: ${data.meetingId || data.roomId || "?"}`);

    } else if (type === "livestream-stopped") {
      console.log(`📡🔴 LIVESTREAM STOPPED | roomId: ${data.meetingId || data.roomId || "?"}`);

    } else if (type === "hls-started") {
      console.log(`📺🟢 HLS STARTED | roomId: ${data.meetingId || data.roomId || "?"}`);

    } else if (type === "hls-stopped") {
      console.log(`📺🔴 HLS STOPPED | roomId: ${data.meetingId || data.roomId || "?"}`);

    } else {
      console.log(`❓🆕 UNKNOWN EVENT: "${type}" | Full body 👇`);
      console.log(JSON.stringify(req.body, null, 2));
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function handleCallAnswered(req, res, next) {
  try {
    const data = req.body.data || {};
    const type = req.body.webhookType || "call-answered";
    const roomId = data.meetingId || data.roomId || req.body.roomId || "?";
    writeLog(`Telephony event callback: call-answered | room: ${roomId}`, "info", "webhook", { type, roomId });
    
    console.log(`\n=================== [CALL ANSWERED WEBHOOK RECEIVED] ===================`);
    console.log(JSON.stringify(req.body, null, 2));
    console.log(`========================================================================\n`);
    
    await webhookService.handleCallStatusUpdate(type, data, req);
    
    return res.status(200).json({ success: true, message: "Call answered logged" });
  } catch (err) {
    next(err);
  }
}

export async function handleCallMissed(req, res, next) {
  try {
    const data = req.body.data || {};
    const type = req.body.webhookType || "call-missed";
    const roomId = data.meetingId || data.roomId || req.body.roomId || "?";
    writeLog(`Telephony event callback: call-missed | room: ${roomId}`, "info", "webhook", { type, roomId });
    
    console.log(`\n=================== [CALL MISSED WEBHOOK RECEIVED] ===================`);
    console.log(JSON.stringify(req.body, null, 2));
    console.log(`======================================================================\n`);
    
    await webhookService.handleCallStatusUpdate(type, data, req);
    
    return res.status(200).json({ success: true, message: "Call missed logged" });
  } catch (err) {
    next(err);
  }
}

export async function handleCallTransferred(req, res, next) {
  try {
    const data = req.body.data || {};
    const type = req.body.webhookType || "call-transferred";
    const roomId = data.meetingId || data.roomId || req.body.roomId || "?";
    writeLog(`Telephony event callback: call-transferred | room: ${roomId}`, "info", "webhook", { type, roomId });
    
    console.log(`\n=================== [CALL TRANSFERRED WEBHOOK RECEIVED] ===================`);
    console.log(JSON.stringify(req.body, null, 2));
    console.log(`===========================================================================\n`);
    
    await webhookService.handleCallStatusUpdate(type, data, req);
    
    return res.status(200).json({ success: true, message: "Call transferred logged" });
  } catch (err) {
    next(err);
  }
}
