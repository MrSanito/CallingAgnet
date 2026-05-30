import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { Lead, CallHistory, CallRecording } from "@/models/mongooseModels";

export async function GET(request, { params }) {
  try {
    await dbConnect();
    const { id } = await params;

    const lead = await Lead.findById(id).lean();
    if (!lead) {
      return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
    }

    // Fetch all calls for this lead, newest first
    const calls = await CallHistory.find({ leadId: id }).sort({ createdAt: -1 }).lean();

    // Fetch recordings for all calls
    const callIds = calls.map(c => c._id);
    const recordings = await CallRecording.find({ callId: { $in: callIds }, status: "completed" }).lean();
    const recMap = {};
    for (const r of recordings) {
      recMap[r.callId.toString()] = r;
    }

    const callList = calls.map(c => {
      const durSec = c.duration || 0;
      const durStr = durSec > 0
        ? `${String(Math.floor(durSec / 60)).padStart(2, "0")}:${String(durSec % 60).padStart(2, "0")}`
        : "—";

      const rec = recMap[c._id.toString()] || null;

      return {
        callId: c._id.toString(),
        roomId: c.roomId || null,
        attemptCount: c.attemptCount || 1,
        status: c.status,
        resolution: c.resolution,
        sentiment: c.sentiment,
        summary: c.summary,
        nextAction: c.nextAction,
        duration: durStr,
        durationSec: durSec,
        startedAt: c.startedAt,
        endedAt: c.endedAt,
        createdAt: c.createdAt,
        hasRecording: !!rec?.fileUrl,
        recordingUrl: rec?.fileUrl || null
      };
    });

    return NextResponse.json({
      success: true,
      lead: {
        id: lead._id.toString(),
        name: lead.clientName,
        phone: lead.clientNumber,
        shopName: lead.shopName || "—",
        requirement: lead.clientRequirement || "—",
        status: lead.status,
        totalAttempts: lead.totalAttempts || 0
      },
      totalCalls: callList.length,
      calls: callList
    });

  } catch (error) {
    console.error("Lead calls API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
