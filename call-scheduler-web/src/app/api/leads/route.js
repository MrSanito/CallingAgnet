import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { Lead, CallHistory } from "@/models/mongooseModels";

export async function GET() {
  try {
    await dbConnect();

    const leads = await Lead.find({}).sort({ createdAt: -1 }).lean();

    // Fetch latest call history for each lead
    const leadIds = leads.map(l => l._id);
    const latestCalls = await CallHistory.aggregate([
      { $match: { leadId: { $in: leadIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$leadId",
          lastCallId: { $first: "$_id" },
          lastCallStatus: { $first: "$status" },
          lastCallResolution: { $first: "$resolution" },
          lastCallSentiment: { $first: "$sentiment" },
          lastCallSummary: { $first: "$summary" },
          lastCallDuration: { $first: "$duration" },
          lastCallDate: { $first: "$createdAt" },
          callCount: { $sum: 1 }
        }
      }
    ]);

    const callMap = {};
    for (const c of latestCalls) {
      callMap[c._id.toString()] = c;
    }

    const statusColorMap = {
      pending: { label: "Pending", color: "amber" },
      active: { label: "Active", color: "blue" },
      completed: { label: "Completed", color: "emerald" },
      failed: { label: "Failed", color: "rose" }
    };

    const resolutionColorMap = {
      trial_setup: { label: "Trial Setup", color: "emerald" },
      interested: { label: "Interested", color: "indigo" },
      deal_closed: { label: "Deal Closed", color: "emerald" },
      follow_up_needed: { label: "Follow Up", color: "amber" },
      callback_requested: { label: "Callback", color: "blue" },
      not_interested: { label: "Not Interested", color: "rose" },
      busy: { label: "Busy", color: "orange" },
      wrong_number: { label: "Wrong Number", color: "rose" },
      no_answer: { label: "No Answer", color: "slate" }
    };

    const data = leads.map(lead => {
      const call = callMap[lead._id.toString()] || null;

      const durSec = call?.lastCallDuration || 0;
      const durStr = durSec > 0
        ? `${String(Math.floor(durSec / 60)).padStart(2, "0")}:${String(durSec % 60).padStart(2, "0")}`
        : "—";

      return {
        id: lead._id.toString().slice(-6).toUpperCase(),
        fullId: lead._id.toString(),
        name: lead.clientName || "Unknown",
        phone: lead.clientNumber || "—",
        shopName: lead.shopName || "—",
        requirement: lead.clientRequirement || "—",
        status: statusColorMap[lead.status] || statusColorMap.pending,
        attempts: lead.totalAttempts || 0,
        createdAt: lead.createdAt,
        // Latest call info
        lastCallId: call?.lastCallId?.toString() || null,
        lastCallStatus: call?.lastCallStatus || null,
        lastCallResolution: call?.lastCallResolution ? (resolutionColorMap[call.lastCallResolution] || { label: call.lastCallResolution, color: "slate" }) : null,
        lastCallSentiment: call?.lastCallSentiment || null,
        lastCallSummary: call?.lastCallSummary || null,
        lastCallDuration: durStr,
        lastCallDurationSec: durSec,
        lastCallDate: call?.lastCallDate || null,
        totalCalls: call?.callCount || 0
      };
    });

    return NextResponse.json({
      success: true,
      total: data.length,
      leads: data
    });

  } catch (error) {
    console.error("Leads API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
