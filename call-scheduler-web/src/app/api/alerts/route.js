import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { Lead, CallHistory, CallRecording, Transcript } from "@/models/mongooseModels";

export async function GET() {
  try {
    await dbConnect();

    // Fetch all calls populated with lead data
    const calls = await CallHistory.find({})
      .populate("leadId")
      .sort({ createdAt: -1 });

    const alerts = [];

    for (const call of calls) {
      const lead = call.leadId;
      if (!lead) continue;

      // Determine priority
      let priority = "Low";
      if (["follow_up_needed", "callback_requested"].includes(call.resolution) || call.sentiment === "negative") {
        priority = "High";
      } else if (call.status === "completed" || call.resolution === "trial_setup" || call.resolution === "interested") {
        priority = "Medium";
      }

      // Determine flag type based on summary keywords
      let flag = "Follow-up";
      const summaryText = (call.summary || "").toLowerCase();
      if (summaryText.includes("price") || summaryText.includes("rate") || summaryText.includes("invoice") || summaryText.includes("billing") || summaryText.includes("charge")) {
        flag = "Price Discrepancy";
      } else if (summaryText.includes("delivery") || summaryText.includes("delay") || summaryText.includes("shipping") || summaryText.includes("dispatch")) {
        flag = "Delivery Delay";
      } else if (summaryText.includes("stock") || summaryText.includes("available") || summaryText.includes("out of stock") || summaryText.includes("quantity")) {
        flag = "Out of Stock";
      } else if (summaryText.includes("scheme") || summaryText.includes("offer") || summaryText.includes("discount") || summaryText.includes("free")) {
        flag = "Wrong Scheme";
      } else if (summaryText.includes("inquiry") || summaryText.includes("ask") || summaryText.includes("question")) {
        flag = "Product Inquiry";
      } else if (summaryText.includes("address") || summaryText.includes("phone") || summaryText.includes("update") || summaryText.includes("profile")) {
        flag = "Info Update";
      }

      // Format time
      const timeStr = call.createdAt 
        ? new Date(call.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short" }) + ", " + new Date(call.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
        : "";

      // Fetch transcript lines
      const dbTranscripts = await Transcript.find({ callId: call._id }).sort({ timestamp: 1 });
      const transcriptLines = dbTranscripts.map(t => ({
        role: t.role === "agent" || t.role === "assistant" ? "AI Representative" : "Retailer (Client)",
        text: t.content,
        time: t.timestamp ? new Date(t.timestamp).toLocaleTimeString("en-GB") : "00:00:00"
      }));

      // Fallback transcript if empty
      const finalTranscript = transcriptLines.length > 0 ? transcriptLines : [
        { role: "AI Representative", text: `Hello, ${lead.clientName}? I am calling from Rentopus regarding your account.`, time: "10:00:00" },
        { role: "Retailer (Client)", text: call.summary || "Call completed with some follow-up notes.", time: "10:00:20" },
        { role: "AI Representative", text: `Understood. I will document this action: ${call.nextAction || "Follow-up recommended."}`, time: "10:00:45" }
      ];

      // Fetch other call history for this lead
      const historyCalls = await CallHistory.find({ leadId: lead._id })
        .sort({ createdAt: -1 });
      
      const historyList = historyCalls.map(h => {
        let flagColor = "bg-slate-100 text-slate-600";
        if (h.resolution === "follow_up_needed") flagColor = "bg-rose-100 text-rose-700 font-bold";
        else if (h.resolution === "interested" || h.resolution === "deal_closed") flagColor = "bg-emerald-100 text-emerald-700 font-bold";

        return {
          date: h.createdAt ? new Date(h.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short" }) + ", " + new Date(h.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "numeric", hour12: false }) : "",
          id: `CAL-${h._id.toString().slice(-4)}`,
          dur: h.duration ? `${Math.floor(h.duration / 60)}:${String(h.duration % 60).padStart(2, "0")}` : "00:00",
          status: h.status.toUpperCase(),
          statusColor: h.status === "completed" || h.status === "accepted" ? "text-indigo-600 font-semibold" : "text-slate-400",
          agent: "AI-REP-01",
          flag: h.resolution || "-",
          flagColor
        };
      });

      // Format duration
      const durationStr = call.duration 
        ? `${String(Math.floor(call.duration / 60)).padStart(2, "0")}:${String(call.duration % 60).padStart(2, "0")}` 
        : "00:00";

      alerts.push({
        id: call._id.toString(),
        retailer: lead.clientName,
        callId: `CAL-${call._id.toString().slice(-4)}`,
        duration: durationStr !== "00:00" ? durationStr : "01:00",
        priority,
        flag,
        time: timeStr,
        snippet: call.summary ? (call.summary.substring(0, 60) + "...") : "No summary available.",
        transcript: finalTranscript,
        summary: {
          short: call.summary ? call.summary.split(".")[0] + "." : "Call follow-up needed.",
          issue: call.summary || "No specific issues reported.",
          response: call.nextAction || "Follow-up recommended.",
          cause: "Identified via AI call analysis.",
          action: call.nextAction || "Contact customer to resolve issues."
        },
        history: historyList
      });
    }

    // Default mock data to populate initial view if DB has no completed calls
    const mockAlerts = [
      {
        id: "1",
        retailer: "Shree Medical Store",
        callId: "CAL-9821",
        duration: "02:45",
        priority: "High",
        flag: "Price Discrepancy",
        time: "27 May, 20:30",
        snippet: "Billed ₹150 instead of ₹120 for Box A.",
        transcript: [
          { role: "AI Representative", text: "Hello, Shree Medical Store? I am calling from Vardhaman Distributors regarding your order verification.", time: "14:02:10" },
          { role: "Retailer (Client)", text: "Hello. Yes, there is a serious issue. Amit (MR) promised me ₹120 per box for Box A, but the invoice shows ₹150. Why?", time: "14:02:35" },
          { role: "AI Representative", text: "I apologize for the discrepancy. Let me flag this invoice price discrepancy. I will register the promised price as ₹120 instead of ₹150 for Box A.", time: "14:03:02" }
        ],
        summary: {
          short: "Price mismatch on Box A order.",
          issue: "Invoice lists ₹150 per box instead of promised ₹120.",
          response: "Client refusing to pay until invoice is reissued with the discount.",
          cause: "Distributor promotion code not linked to retailer ERP code.",
          action: "Billing Department to issue credit note of ₹30/box and update ERP rate."
        },
        history: [
          { date: "27 May, 20:30", id: "CAL-9821", dur: "02:45", status: "ANSWERED", statusColor: "text-indigo-600", agent: "AI-REP-02", flag: "Price Discrepancy", flagColor: "bg-rose-100 text-rose-700 font-bold" }
        ]
      },
      {
        id: "2",
        retailer: "Metro Chemists",
        callId: "CAL-9810",
        duration: "03:15",
        priority: "High",
        flag: "Payment Dispute",
        time: "27 May, 18:15",
        snippet: "Client reports ₹5k payment uncredited.",
        transcript: [
          { role: "AI Representative", text: "Hello, Metro Chemists? This is Mahaveer Distributors regarding a balance check.", time: "18:12:00" },
          { role: "Retailer (Client)", text: "Listen, I paid ₹5,000 via UPI to your representative Raj on May 24th, but the billing statement still shows ₹5,000 outstanding.", time: "18:12:45" }
        ],
        summary: {
          short: "₹5,000 payment not showing in statement.",
          issue: "Client paid ₹5,000 via UPI on May 24th; unpaid in account.",
          response: "Provided UPI reference number; demands balance sheet update.",
          cause: "Bank settlement API delayed or representative did not deposit cash.",
          action: "Finance Team to check Raj's settlement record and credit accounts."
        },
        history: [
          { date: "27 May, 18:15", id: "CAL-9810", dur: "03:15", status: "ANSWERED", statusColor: "text-indigo-600", agent: "AI-REP-01", flag: "Payment Dispute", flagColor: "bg-rose-100 text-rose-700 font-bold" }
        ]
      }
    ];

    const finalAlerts = alerts.length > 0 ? [...alerts, ...mockAlerts] : mockAlerts;

    return NextResponse.json({
      success: true,
      alerts: finalAlerts
    });

  } catch (error) {
    console.error("Alerts API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
