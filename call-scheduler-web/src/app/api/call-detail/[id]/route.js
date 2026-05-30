import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { CallHistory, Transcript, CallRecording } from "@/models/mongooseModels";

export async function GET(request, { params }) {
  try {
    await dbConnect();
    const { id } = await params;

    // Fetch the call with lead populated
    const call = await CallHistory.findById(id).populate("leadId");
    if (!call) {
      return NextResponse.json({ success: false, error: "Call not found" }, { status: 404 });
    }

    // Fetch transcript utterances (parsed lines)
    const transcriptLines = await Transcript.find({ callId: id }).sort({ createdAt: 1 });

    // Fetch recording
    const recording = await CallRecording.findOne({ callId: id, status: "completed" });

    const durSec = call.duration || 0;
    const durStr = durSec > 0
      ? `${String(Math.floor(durSec / 60)).padStart(2, "0")}:${String(durSec % 60).padStart(2, "0")}`
      : "—";

    return NextResponse.json({
      success: true,
      call: {
        id: call._id.toString(),
        name: call.leadId?.clientName || "Unknown",
        phone: call.leadId?.clientNumber || "—",
        shopName: call.leadId?.shopName || "—",
        requirement: call.leadId?.clientRequirement || null,
        duration: durStr,
        durationSec: durSec,
        status: call.hangupCause === "normal_clearing" ? "accepted" : (call.hangupCause || call.status),
        resolution: call.resolution,
        sentiment: call.sentiment,
        summary: call.summary,
        nextAction: call.nextAction,
        attempts: call.attemptCount || 1,
        tokenUsage: call.tokenUsage || null,
        rawTranscript: call.rawTranscript || null,
        agentLanguage: call.agentLanguage || null,
        customerName: call.customerName || null,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        createdAt: call.createdAt,
        roomId: call.roomId || null
      },
      transcriptLines: transcriptLines.map(t => ({
        role: t.role,
        content: t.content,
        timestamp: t.timestamp || t.createdAt
      })),
      recording: recording ? {
        recordingId: recording.recordingId,
        fileUrl: recording.fileUrl,
        duration: recording.duration,
        size: recording.size,
        format: recording.format,
        status: recording.status
      } : null
    });

  } catch (error) {
    console.error("Call detail API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
